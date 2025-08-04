# WhatsApp Multi-Automation System

A powerful Node.js application that allows you to manage multiple WhatsApp accounts simultaneously with a modern web dashboard, real-time webhooks, and comprehensive message logging using Supabase database.

## 🚀 Features

### Core Features
- ✅ **Multi-Account Management**: Create and manage multiple WhatsApp accounts simultaneously
- ✅ **Modern Dashboard**: Beautiful dark theme with gradients and real-time updates
- ✅ **QR Code Authentication**: Easy WhatsApp Web authentication via QR codes
- ✅ **Webhook Support**: Individual webhooks for each account with delivery tracking
- ✅ **Message Logging**: Comprehensive logging of all incoming/outgoing messages
- ✅ **Real-time Updates**: Live status updates and message notifications
- ✅ **Secure Authentication**: Password-protected dashboard with session management

### Technical Features
- ✅ **Supabase Integration**: PostgreSQL database with real-time capabilities
- ✅ **Socket.IO**: Real-time communication between server and dashboard
- ✅ **WhatsApp Web.js**: Official WhatsApp Web API integration
- ✅ **Session Persistence**: LocalAuth strategy for maintaining sessions
- ✅ **Media Support**: Handle images, documents, and other media types
- ✅ **Error Handling**: Comprehensive error logging and recovery
- ✅ **Responsive Design**: Mobile-friendly dashboard interface

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Supabase account and project
- WhatsApp account(s) for authentication

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd wa-multi-automation
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Run the SQL schema from `supabase-schema.sql`
4. Note down your project URL and API keys

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Dashboard Authentication
DASHBOARD_PASSWORD=your-secure-password
DASHBOARD_USERNAME=admin

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-here

# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Logging Configuration
LOG_LEVEL=info
```

### 5. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The application will be available at:
- **Dashboard**: http://localhost:3000/dashboard
- **Login**: http://localhost:3000/login

## 📱 Usage

### 1. Access the Dashboard

1. Navigate to http://localhost:3000/login
2. Use the credentials from your `.env` file
3. You'll be redirected to the dashboard

### 2. Create WhatsApp Accounts

1. Click "Add Account" in the dashboard
2. Enter a name and optional description
3. The system will generate a QR code
4. Scan the QR code with your WhatsApp mobile app
5. Wait for the account to connect (status will change to "Ready")

### 3. Configure Webhooks

1. Click "Webhooks" on any account
2. Add webhook URLs to receive message notifications
3. Optionally add a secret for security
4. Enable/disable webhooks as needed

### 4. Send Messages

1. Click "Send" on any connected account
2. Enter the phone number (with or without country code)
3. Type your message
4. Click "Send Message"

### 5. Monitor Activity

- View real-time statistics on the dashboard
- Check message logs for each account
- Monitor webhook delivery status
- Track success/failure rates

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Login to dashboard
- `POST /api/auth/logout` - Logout from dashboard
- `GET /api/auth/user` - Get current user info

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:id` - Get specific account
- `DELETE /api/accounts/:id` - Delete account
- `GET /api/accounts/:id/qr` - Get QR code for account

### Webhooks
- `GET /api/accounts/:id/webhooks` - Get webhooks for account
- `POST /api/webhooks` - Create new webhook
- `PATCH /api/webhooks/:id/toggle` - Toggle webhook status
- `DELETE /api/webhooks/:id` - Delete webhook

### Messages
- `POST /api/send` - Send message
- `GET /api/accounts/:id/logs` - Get message logs

### Statistics
- `GET /api/stats` - Get dashboard statistics

### Public Webhook
- `POST /webhook/:accountId` - Receive incoming webhooks

## 📊 Database Schema

### Tables

1. **whatsapp_accounts**: Stores account information and status
2. **webhooks**: Stores webhook configurations for each account
3. **message_logs**: Stores all message activity and webhook delivery logs

### Key Fields

- Account status: `initializing`, `qr_ready`, `ready`, `disconnected`, `auth_failed`
- Message direction: `incoming`, `outgoing`, `webhook`, `webhook_incoming`
- Message status: `success`, `failed`

## 🔒 Security Features

- Password-protected dashboard
- Session-based authentication
- Webhook secrets for secure delivery
- Input validation and sanitization
- CORS protection
- Rate limiting (can be added)

## 🚀 Deployment

### Deploy to Render

1. Connect your repository to Render
2. Create a new Web Service
3. Set environment variables
4. Deploy

### Deploy to Railway

1. Connect your repository to Railway
2. Add environment variables
3. Deploy automatically

### Deploy to Heroku

1. Create a Heroku app
2. Set environment variables
3. Deploy using Git

## 📝 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment mode | No | development |
| `DASHBOARD_PASSWORD` | Dashboard password | Yes | - |
| `DASHBOARD_USERNAME` | Dashboard username | Yes | - |
| `SESSION_SECRET` | Session encryption key | Yes | - |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | - |

## 🔧 Configuration

### Customizing Phone Number Format

Edit the `formatPhoneNumber` function in `utils/whatsappManager.js` to change the default country code:

```javascript
// Default to India (+91)
if (!cleaned.startsWith('+')) {
  cleaned = '+91' + cleaned; // Change this to your default country code
}
```

### Adding Custom Webhook Headers

Modify the webhook delivery in `utils/whatsappManager.js`:

```javascript
const response = await axios.post(webhook.url, messageData, {
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': webhook.secret || '',
    'X-Account-ID': accountId,
    'X-Custom-Header': 'your-custom-value' // Add custom headers
  },
  timeout: 10000
});
```

## 🐛 Troubleshooting

### Common Issues

1. **QR Code not appearing**
   - Wait a few seconds after creating account
   - Check browser console for errors
   - Ensure WhatsApp Web.js is properly initialized

2. **Messages not sending**
   - Verify account is authenticated (status: "ready")
   - Check phone number format
   - Review console logs for errors

3. **Webhook not receiving data**
   - Verify webhook URL is accessible
   - Check webhook is active
   - Monitor console logs for delivery status

4. **Database connection issues**
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database schema is properly set up

### Logs

Check the console output for detailed error messages and debugging information.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check the troubleshooting section
2. Review the console logs
3. Verify your configuration
4. Open an issue on GitHub

## 🔄 Updates

Stay updated with the latest features and bug fixes by regularly pulling from the repository.

---

**Note**: This application uses WhatsApp Web.js which is not officially supported by WhatsApp. Use at your own risk and ensure compliance with WhatsApp's terms of service. 