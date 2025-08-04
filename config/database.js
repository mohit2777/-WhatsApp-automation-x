const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

// Database helper functions
const db = {
  // Account management
  async createAccount(accountData) {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .insert([accountData])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async getAccounts() {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getAccount(id) {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateAccount(id, updates) {
    const { data, error } = await supabase
      .from('whatsapp_accounts')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async deleteAccount(id) {
    const { error } = await supabase
      .from('whatsapp_accounts')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // Webhook management
  async createWebhook(webhookData) {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .insert([webhookData])
        .select();
      
      if (error) {
        console.error('Supabase error creating webhook:', error);
        throw error;
      }
      return data[0];
    } catch (error) {
      console.error('Error in createWebhook:', error);
      throw error;
    }
  },

  async getWebhooks(accountId) {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getWebhook(id) {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateWebhook(id, updates) {
    const { data, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async deleteWebhook(id) {
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // Message logging
  async logMessage(messageData) {
    const { data, error } = await supabase
      .from('message_logs')
      .insert([messageData])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async getMessageLogs(accountId, limit = 100) {
    const { data, error } = await supabase
      .from('message_logs')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async getMessageStats(accountId) {
    const { data, error } = await supabase
      .from('message_logs')
      .select('direction, status')
      .eq('account_id', accountId);
    
    if (error) throw error;
    
    const stats = {
      total: data.length,
      incoming: data.filter(m => m.direction === 'incoming').length,
      outgoing: data.filter(m => m.direction === 'outgoing').length,
      success: data.filter(m => m.status === 'success').length,
      failed: data.filter(m => m.status === 'failed').length
    };
    
    return stats;
  }
};

module.exports = { supabase, db }; 