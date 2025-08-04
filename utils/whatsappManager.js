const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database');
const axios = require('axios');
const moment = require('moment');

class WhatsAppManager {
  constructor() {
    this.clients = new Map(); // Store active WhatsApp clients
    this.qrCodes = new Map(); // Store QR codes for each account
    this.accountStatus = new Map(); // Store account status
  }

  // Create a new WhatsApp account instance
  async createAccount(accountName, description = '') {
    try {
      const accountId = uuidv4();
      const sessionDir = `./sessions/${accountId}`;
      
      // Create account in database
      const accountData = {
        id: accountId,
        name: accountName,
        description: description,
        status: 'initializing',
        session_dir: sessionDir,
        created_at: new Date().toISOString()
      };

      const account = await db.createAccount(accountData);
      
      // Initialize WhatsApp client
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: accountId,
          dataPath: sessionDir
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Set up event handlers
      this.setupEventHandlers(client, accountId);

      // Store client reference
      this.clients.set(accountId, client);
      this.accountStatus.set(accountId, 'initializing');

      // Initialize the client
      await client.initialize();

      return account;
    } catch (error) {
      console.error('Error creating WhatsApp account:', error);
      throw error;
    }
  }

  // Set up event handlers for a WhatsApp client
  setupEventHandlers(client, accountId) {
    client.on('qr', async (qr) => {
      try {
        // Generate QR code as data URL
        const qrDataUrl = await qrcode.toDataURL(qr);
        this.qrCodes.set(accountId, qrDataUrl);
        
        // Update account status
        await db.updateAccount(accountId, { 
          status: 'qr_ready',
          qr_code: qrDataUrl,
          updated_at: new Date().toISOString()
        });
        
        this.accountStatus.set(accountId, 'qr_ready');
        console.log(`QR code generated for account ${accountId}`);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    });

    client.on('ready', async () => {
      try {
        // Update account status
        await db.updateAccount(accountId, { 
          status: 'ready',
          phone_number: client.info.wid.user,
          updated_at: new Date().toISOString()
        });
        
        this.accountStatus.set(accountId, 'ready');
        this.qrCodes.delete(accountId); // Clear QR code
        
        console.log(`WhatsApp client ready for account ${accountId}`);
      } catch (error) {
        console.error('Error updating account status:', error);
      }
    });

    client.on('authenticated', () => {
      console.log(`WhatsApp client authenticated for account ${accountId}`);
    });

    client.on('auth_failure', async (msg) => {
      try {
        await db.updateAccount(accountId, { 
          status: 'auth_failed',
          error_message: msg,
          updated_at: new Date().toISOString()
        });
        
        this.accountStatus.set(accountId, 'auth_failed');
        console.error(`Authentication failed for account ${accountId}:`, msg);
      } catch (error) {
        console.error('Error updating account status:', error);
      }
    });

    client.on('disconnected', async (reason) => {
      try {
        await db.updateAccount(accountId, { 
          status: 'disconnected',
          error_message: reason,
          updated_at: new Date().toISOString()
        });
        
        this.accountStatus.set(accountId, 'disconnected');
        console.log(`WhatsApp client disconnected for account ${accountId}:`, reason);
      } catch (error) {
        console.error('Error updating account status:', error);
      }
    });

    client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(client, accountId, message);
      } catch (error) {
        console.error('Error handling incoming message:', error);
      }
    });
  }

  // Handle incoming messages
  async handleIncomingMessage(client, accountId, message) {
    try {
      const chat = await message.getChat();
      
      // Prepare message data
      const messageData = {
        account_id: accountId,
        direction: 'incoming',
        message_id: message.id._serialized,
        sender: message.from,
        recipient: message.to,
        message: message.body,
        timestamp: message.timestamp,
        type: message.type,
        chat_id: chat.id._serialized,
        is_group: chat.isGroup,
        group_name: chat.isGroup ? chat.name : null,
        created_at: new Date().toISOString()
      };

      // Add media data if present
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        messageData.media = {
          mimetype: media.mimetype,
          data: media.data,
          filename: media.filename
        };
      }

      // Log message to database
      await db.logMessage(messageData);

      // Send to webhooks
      await this.sendToWebhooks(accountId, messageData);

    } catch (error) {
      console.error('Error handling incoming message:', error);
      
      // Log error
      await db.logMessage({
        account_id: accountId,
        direction: 'incoming',
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString()
      });
    }
  }

  // Send message to webhooks
  async sendToWebhooks(accountId, messageData) {
    try {
      const webhooks = await db.getWebhooks(accountId);
      
      for (const webhook of webhooks) {
        if (!webhook.is_active) continue;
        
        try {
          const response = await axios.post(webhook.url, messageData, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhook.secret || '',
              'X-Account-ID': accountId
            },
            timeout: 10000
          });

          // Log successful webhook delivery
          await db.logMessage({
            account_id: accountId,
            direction: 'webhook',
            status: 'success',
            webhook_id: webhook.id,
            webhook_url: webhook.url,
            response_status: response.status,
            created_at: new Date().toISOString()
          });

        } catch (error) {
          // Log failed webhook delivery
          await db.logMessage({
            account_id: accountId,
            direction: 'webhook',
            status: 'failed',
            webhook_id: webhook.id,
            webhook_url: webhook.url,
            error_message: error.message,
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error sending to webhooks:', error);
    }
  }

  // Send message from an account
  async sendMessage(accountId, number, message, options = {}) {
    try {
      console.log(`sendMessage called with: accountId=${accountId}, number=${number}, message=${message}`);
      
      const client = this.clients.get(accountId);
      if (!client) {
        console.error(`WhatsApp client not found for account ${accountId}`);
        throw new Error('WhatsApp client not found for this account');
      }

      // Check if client is ready
      const status = this.accountStatus.get(accountId);
      console.log(`Account ${accountId} status: ${status}`);
      if (status !== 'ready') {
        throw new Error(`WhatsApp client is not ready. Current status: ${status}`);
      }

      // Additional check for client state
      if (!client.pupPage || client.pupPage._closed) {
        console.error(`WhatsApp client page is closed or not available for account ${accountId}`);
        throw new Error('WhatsApp client page is closed or not available');
      }

      // Format phone number
      const formattedNumber = this.formatPhoneNumber(number);
      
      console.log(`Sending message to ${formattedNumber} from account ${accountId}`);
      
      // Send message
      const result = await client.sendMessage(formattedNumber, message, options);
      
      // Log outgoing message
      const messageData = {
        account_id: accountId,
        direction: 'outgoing',
        message_id: result.id._serialized,
        sender: result.from,
        recipient: result.to,
        message: message,
        timestamp: result.timestamp,
        type: 'text',
        status: 'success',
        created_at: new Date().toISOString()
      };

      await db.logMessage(messageData);
      
      return {
        success: true,
        messageId: result.id._serialized,
        timestamp: result.timestamp
      };

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Log failed message
      await db.logMessage({
        account_id: accountId,
        direction: 'outgoing',
        recipient: number,
        message: message,
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString()
      });

      throw error;
    }
  }

  // Format phone number for WhatsApp
  formatPhoneNumber(number) {
    // Remove any non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');
    
    // If no country code, assume it's a local number
    if (!cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned; // Default to India (+91)
    }
    
    // Add @c.us suffix for WhatsApp
    return cleaned + '@c.us';
  }

  // Get QR code for an account
  getQRCode(accountId) {
    return this.qrCodes.get(accountId);
  }

  // Get account status
  getAccountStatus(accountId) {
    return this.accountStatus.get(accountId);
  }

  // Get all account statuses
  getAllAccountStatuses() {
    const statuses = {};
    for (const [accountId, status] of this.accountStatus) {
      statuses[accountId] = status;
    }
    return statuses;
  }

  // Delete an account
  async deleteAccount(accountId) {
    try {
      const client = this.clients.get(accountId);
      if (client) {
        await client.destroy();
        this.clients.delete(accountId);
      }
      
      this.qrCodes.delete(accountId);
      this.accountStatus.delete(accountId);
      
      // Delete from database
      await db.deleteAccount(accountId);
      
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  // Initialize existing accounts from database
  async initializeExistingAccounts() {
    try {
      const accounts = await db.getAccounts();
      
      for (const account of accounts) {
        if (account.status === 'ready' || account.status === 'qr_ready') {
          await this.reconnectAccount(account);
        }
      }
    } catch (error) {
      console.error('Error initializing existing accounts:', error);
    }
  }

  // Reconnect to an existing account
  async reconnectAccount(account) {
    try {
      const sessionDir = `./sessions/${account.id}`;
      
      // Initialize WhatsApp client with existing session
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: account.id,
          dataPath: sessionDir
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Set up event handlers
      this.setupEventHandlers(client, account.id);

      // Store client reference
      this.clients.set(account.id, client);
      this.accountStatus.set(account.id, 'initializing');

      // Initialize the client
      await client.initialize();

      console.log(`Reconnected to existing account: ${account.name} (${account.id})`);
    } catch (error) {
      console.error(`Error reconnecting to account ${account.id}:`, error);
      // Update account status to disconnected if reconnection fails
      await db.updateAccount(account.id, { 
        status: 'disconnected',
        updated_at: new Date().toISOString()
      });
      this.accountStatus.set(account.id, 'disconnected');
    }
  }
}

module.exports = new WhatsAppManager(); 