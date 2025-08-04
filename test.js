const { db } = require('./config/database');

async function testDatabaseConnection() {
  try {
    console.log('🧪 Testing database connection...');
    
    // Test basic database operations
    const testAccount = {
      id: 'test-' + Date.now(),
      name: 'Test Account',
      description: 'Test account for database connection',
      status: 'test',
      created_at: new Date().toISOString()
    };

    // Test creating an account
    console.log('📝 Testing account creation...');
    const createdAccount = await db.createAccount(testAccount);
    console.log('✅ Account created:', createdAccount.name);

    // Test getting accounts
    console.log('📋 Testing account retrieval...');
    const accounts = await db.getAccounts();
    console.log('✅ Retrieved accounts:', accounts.length);

    // Test getting specific account
    console.log('🔍 Testing specific account retrieval...');
    const account = await db.getAccount(createdAccount.id);
    console.log('✅ Retrieved account:', account.name);

    // Test updating account
    console.log('✏️ Testing account update...');
    const updatedAccount = await db.updateAccount(createdAccount.id, {
      description: 'Updated test account'
    });
    console.log('✅ Account updated:', updatedAccount.description);

    // Test deleting account
    console.log('🗑️ Testing account deletion...');
    await db.deleteAccount(createdAccount.id);
    console.log('✅ Account deleted successfully');

    // Test webhook operations
    console.log('🔗 Testing webhook operations...');
    const testWebhook = {
      id: 'webhook-' + Date.now(),
      account_id: 'test-account',
      url: 'https://test.com/webhook',
      secret: 'test-secret',
      is_active: true,
      created_at: new Date().toISOString()
    };

    const createdWebhook = await db.createWebhook(testWebhook);
    console.log('✅ Webhook created:', createdWebhook.url);

    const webhooks = await db.getWebhooks('test-account');
    console.log('✅ Retrieved webhooks:', webhooks.length);

    await db.deleteWebhook(createdWebhook.id);
    console.log('✅ Webhook deleted successfully');

    // Test message logging
    console.log('💬 Testing message logging...');
    const testMessage = {
      account_id: 'test-account',
      direction: 'outgoing',
      message: 'Test message',
      status: 'success',
      created_at: new Date().toISOString()
    };

    const loggedMessage = await db.logMessage(testMessage);
    console.log('✅ Message logged:', loggedMessage.message);

    const messageLogs = await db.getMessageLogs('test-account', 10);
    console.log('✅ Retrieved message logs:', messageLogs.length);

    const messageStats = await db.getMessageStats('test-account');
    console.log('✅ Message stats:', messageStats);

    console.log('\n🎉 All database tests passed successfully!');
    console.log('✅ Database connection is working properly');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 Testing environment variables...');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DASHBOARD_PASSWORD',
    'DASHBOARD_USERNAME',
    'SESSION_SECRET'
  ];

  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    } else {
      console.log(`✅ ${varName}: ${varName.includes('KEY') || varName.includes('SECRET') || varName.includes('PASSWORD') ? '***' : process.env[varName]}`);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
}

async function runTests() {
  console.log('🚀 Starting WhatsApp Multi-Automation System Tests\n');
  
  try {
    await testEnvironmentVariables();
    await testDatabaseConnection();
    
    console.log('\n🎊 All tests completed successfully!');
    console.log('🚀 Your WhatsApp Multi-Automation system is ready to use!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testDatabaseConnection,
  testEnvironmentVariables,
  runTests
}; 