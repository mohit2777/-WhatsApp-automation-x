const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { requireAuth, requireGuest, login, logout, getCurrentUser } = require('./middleware/auth');
const { db } = require('./config/database');
const whatsappManager = require('./utils/whatsappManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to emit socket events
const emitToAll = (event, data) => {
  io.emit(event, data);
};

// Authentication routes
app.get('/login', requireGuest, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/user', getCurrentUser);

// Dashboard route
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API Routes
// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Accounts API
app.get('/api/accounts', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const account = await whatsappManager.createAccount(name, description);
    res.json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const account = await db.getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    await whatsappManager.deleteAccount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Webhooks API
app.get('/api/accounts/:id/webhooks', requireAuth, async (req, res) => {
  try {
    const webhooks = await db.getWebhooks(req.params.id);
    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

app.post('/api/webhooks', requireAuth, async (req, res) => {
  try {
    const { account_id, url, secret, is_active } = req.body;
    
    console.log('Received webhook creation request:', { account_id, url, secret, is_active });
    
    if (!account_id || !url) {
      console.log('Missing required fields:', { account_id, url });
      return res.status(400).json({ error: 'Account ID and URL are required' });
    }

    const webhookData = {
      id: require('uuid').v4(),
      account_id,
      url,
      secret: secret || '',
      is_active: is_active !== false,
      created_at: new Date().toISOString()
    };

    console.log('Creating webhook with data:', webhookData);

    const webhook = await db.createWebhook(webhookData);
    console.log('Webhook created successfully:', webhook);
    res.json(webhook);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook: ' + error.message });
  }
});

app.patch('/api/webhooks/:id/toggle', requireAuth, async (req, res) => {
  try {
    const webhook = await db.getWebhook(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updatedWebhook = await db.updateWebhook(req.params.id, {
      is_active: !webhook.is_active,
      updated_at: new Date().toISOString()
    });

    res.json(updatedWebhook);
  } catch (error) {
    console.error('Error toggling webhook:', error);
    res.status(500).json({ error: 'Failed to toggle webhook' });
  }
});

app.delete('/api/webhooks/:id', requireAuth, async (req, res) => {
  try {
    await db.deleteWebhook(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Get webhook secrets for an account (for n8n configuration)
app.get('/api/accounts/:id/webhook-secrets', requireAuth, async (req, res) => {
  try {
    const webhooks = await db.getWebhooks(req.params.id);
    const webhookSecrets = webhooks.map(webhook => ({
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      is_active: webhook.is_active
    }));
    res.json(webhookSecrets);
  } catch (error) {
    console.error('Error fetching webhook secrets:', error);
    res.status(500).json({ error: 'Failed to fetch webhook secrets' });
  }
});

// Webhook-based reply API (uses webhook secret for authentication)
app.post('/api/webhook-reply', async (req, res) => {
  try {
    const { account_id, number, message, webhook_secret } = req.body;
    
    console.log('Received webhook reply request:', { account_id, number, message });
    
    if (!account_id || !number || !message || !webhook_secret) {
      console.log('Missing required fields:', { account_id: !!account_id, number: !!number, message: !!message, webhook_secret: !!webhook_secret });
      return res.status(400).json({ error: 'Account ID, number, message, and webhook_secret are required' });
    }

    // Verify webhook secret
    const webhooks = await db.getWebhooks(account_id);
    const validWebhook = webhooks.find(webhook => webhook.secret === webhook_secret && webhook.is_active);
    
    if (!validWebhook) {
      console.log('Invalid webhook secret for account:', account_id);
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    console.log('Webhook secret verified, calling whatsappManager.sendMessage...');
    const result = await whatsappManager.sendMessage(account_id, number, message);
    console.log('Message sent successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Error sending webhook reply:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Message sending API (with API key authentication)
app.post('/api/send', requireAuth, async (req, res) => {
  try {
    const { account_id, number, message } = req.body;
    
    console.log('Received send message request:', { account_id, number, message });
    
    if (!account_id || !number || !message) {
      console.log('Missing required fields:', { account_id: !!account_id, number: !!number, message: !!message });
      return res.status(400).json({ error: 'Account ID, number, and message are required' });
    }

    console.log('Calling whatsappManager.sendMessage...');
    const result = await whatsappManager.sendMessage(account_id, number, message);
    console.log('Message sent successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Stats API
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(a => a.status === 'ready').length;
    
    // Get message stats from all accounts
    let totalMessages = 0;
    let successMessages = 0;
    
    for (const account of accounts) {
      const stats = await db.getMessageStats(account.id);
      totalMessages += stats.total;
      successMessages += stats.success;
    }
    
    const successRate = totalMessages > 0 ? Math.round((successMessages / totalMessages) * 100) : 0;
    
    res.json({
      totalAccounts,
      activeAccounts,
      totalMessages,
      successRate
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Message logs API
app.get('/api/accounts/:id/logs', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await db.getMessageLogs(req.params.id, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching message logs:', error);
    res.status(500).json({ error: 'Failed to fetch message logs' });
  }
});

// QR Code API
app.get('/api/accounts/:id/qr', requireAuth, async (req, res) => {
  try {
    const qrCode = whatsappManager.getQRCode(req.params.id);
    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not available' });
    }
    res.json({ qr_code: qrCode });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
});

// Public webhook endpoint for receiving messages
app.post('/webhook/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const messageData = req.body;
    
    // Log the incoming webhook
    await db.logMessage({
      account_id: accountId,
      direction: 'webhook_incoming',
      status: 'success',
      message: JSON.stringify(messageData),
      created_at: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// View routes for dashboard
app.get('/views/dashboard', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    const stats = await db.getMessageStats();
    
    res.json({
      accounts,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

app.get('/views/accounts', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

app.get('/views/webhooks', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    const webhooks = {};
    
    for (const account of accounts) {
      webhooks[account.id] = await db.getWebhooks(account.id);
    }
    
    res.json({ accounts, webhooks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load webhooks' });
  }
});

app.get('/views/messages', requireAuth, async (req, res) => {
  try {
    const accounts = await db.getAccounts();
    const messages = {};
    
    for (const account of accounts) {
      messages[account.id] = await db.getMessageLogs(account.id, 50);
    }
    
    res.json({ accounts, messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Initialize existing accounts on startup
async function initializeApp() {
  try {
    console.log('Initializing WhatsApp Multi-Automation System...');
    
    // Create sessions directory if it doesn't exist
    const fs = require('fs-extra');
    await fs.ensureDir('./sessions');
    
    // Initialize existing accounts
    await whatsappManager.initializeExistingAccounts();
    
    console.log('System initialized successfully!');
  } catch (error) {
    console.error('Error initializing app:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 WhatsApp Multi-Automation Server running on port ${PORT}`);
  console.log(`📱 Dashboard available at: http://localhost:${PORT}/dashboard`);
  console.log(`🔐 Login at: http://localhost:${PORT}/login`);
  
  initializeApp();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io, emitToAll }; 