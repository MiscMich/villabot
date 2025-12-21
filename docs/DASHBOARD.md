# Cluebase AI - Dashboard User Guide

Complete guide for using the Cluebase AI dashboard.

## Getting Started

### Creating an Account

1. Navigate to your Cluebase AI instance
2. Click "Get Started" or "Sign Up"
3. Enter your email and password
4. Check your email for verification link
5. Click the link to verify your account

### Creating a Workspace

After signing in for the first time:

1. You'll be prompted to create a workspace
2. Enter a workspace name (e.g., "Acme Corp")
3. Choose a URL slug (e.g., "acme-corp")
4. Complete the setup wizard

## Setup Wizard

The 8-step setup wizard guides you through initial configuration:

### Step 1: Welcome
Overview of what you'll configure.

### Step 2: Workspace
Already completed if you created a workspace.

### Step 3: Connect Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app for your workspace
3. Enable Socket Mode
4. Copy the Bot Token (`xoxb-...`)
5. Copy the App Token (`xapp-...`)
6. Paste into the wizard

### Step 4: Connect Google Drive

1. Click "Connect Google Drive"
2. Sign in with your Google account
3. Grant access to Google Drive
4. OAuth tokens are saved automatically

### Step 5: Knowledge Sources

**Google Drive Folders:**
- Click "Add Folder"
- Paste the folder ID from the Drive URL
- Assign a category (SOPs, Marketing, etc.)

**Website Scraping:**
- Enter your company website URL
- Set page limit (50-500)
- Configure scraping schedule

### Step 6: Create First Bot

- Enter a name for your bot
- Optionally customize the system prompt
- The bot uses your Slack credentials from Step 3

### Step 7: Review & Launch

- Review all settings
- Click "Launch" to start
- First document sync begins automatically

## Dashboard Overview

### Navigation

The sidebar provides access to:

- **Overview**: Dashboard home with stats
- **Documents**: Knowledge base management
- **Knowledge**: Learned facts and corrections
- **Conversations**: View Slack thread history
- **Analytics**: Usage charts and metrics
- **Bots**: Bot configuration
- **Feedback**: User feedback review
- **Team**: Team member management
- **Billing**: Subscription and payments
- **Settings**: Workspace configuration

## Documents Page

### Document List

View all indexed documents with:
- Title and source
- Category badge
- Last synced timestamp
- Status indicator

### Actions

- **Sync All**: Trigger full document sync
- **Filter**: By category or status
- **Search**: Find specific documents
- **Delete**: Remove from knowledge base

### Document Status

| Status | Meaning |
|--------|---------|
| Active | Indexed and searchable |
| Syncing | Currently being processed |
| Error | Sync failed (hover for details) |
| Outdated | Source has newer version |

## Knowledge Page

### Learned Facts

Facts taught to the bot through Slack conversations.

**Columns:**
- Fact content
- Who taught it
- When it was added
- Verification status

**Actions:**
- Verify/approve facts
- Edit fact content
- Delete incorrect facts

## Conversations Page

View all Slack conversations the bot participated in.

### Thread List

- Channel name
- First message preview
- Message count
- Timestamp

### Thread Detail

Click a thread to view:
- Full conversation history
- Sources used for each response
- User and bot messages

## Analytics Page

### Overview Stats

- Total queries this period
- Average response time
- Satisfaction rate
- Active users

### Charts

- **Query Volume**: Daily query count over time
- **Response Times**: Performance histogram
- **Top Documents**: Most cited sources
- **User Activity**: Queries by user

### Filters

- Time period: Day, Week, Month
- Bot filter: All bots or specific bot

## Bots Page

### Bot List

View all configured bots with:
- Name and status
- Slack workspace
- Last active timestamp
- Error state (if any)

### Bot Actions

- **Create Bot**: Add a new bot
- **Edit**: Modify configuration
- **Toggle Active**: Enable/disable bot
- **Restart**: Reconnect to Slack
- **Delete**: Remove bot

### Bot Configuration

- **Name**: Display name for the bot
- **System Prompt**: AI behavior instructions
- **Slack Tokens**: Bot and App tokens
- **Categories**: Which document categories to search

## Feedback Page

Review user feedback on bot responses.

### Feedback List

- Timestamp
- Query text
- Response summary
- Helpful/Not Helpful indicator
- Review status

### Actions

- **Mark Reviewed**: Acknowledge feedback
- **View Details**: Full query, response, and sources
- **Filter**: By helpful/unhelpful/unreviewed

## Team Page

### Member Management

- View all workspace members
- See role for each member
- Invite new members
- Change roles
- Remove members

### Roles

| Role | Permissions |
|------|-------------|
| Owner | Full access, billing, delete workspace |
| Admin | Manage bots, documents, team members |
| Member | View analytics, basic configuration |

### Inviting Members

1. Click "Invite Member"
2. Enter email address
3. Select role
4. Send invitation
5. User receives email to join

## Billing Page

### Current Plan

View your subscription:
- Plan name and price
- Billing period
- Next payment date
- Usage vs limits

### Usage Meters

Visual progress bars for:
- Queries used / allowed
- Documents indexed / limit
- Team members / limit
- Bots / limit

### Actions

- **Upgrade Plan**: Switch to higher tier
- **Manage Billing**: Open Stripe portal
- **View Invoices**: Payment history

## Settings Page

### Workspace Settings

- Workspace name
- URL slug
- Timezone

### Integrations

**Google Drive:**
- Connection status
- Reconnect button
- Folder mappings

**Slack:**
- Connection status
- Re-authorize button

### Danger Zone

- Export data
- Delete workspace

## Tips & Best Practices

### Document Organization

1. Use categories to organize documents
2. Keep document titles descriptive
3. Remove outdated documents
4. Sync after major updates

### Bot Configuration

1. Customize system prompt for your domain
2. Test responses in Slack
3. Monitor feedback regularly
4. Adjust based on user needs

### Team Management

1. Use appropriate roles (least privilege)
2. Remove inactive members
3. Keep at least one owner

### Cost Optimization

1. Monitor query usage
2. Remove unused documents
3. Consolidate similar documents
4. Consider upgrading if hitting limits

## Troubleshooting

### Bot Not Responding

1. Check bot status on Bots page
2. Verify Slack tokens are valid
3. Try restarting the bot
4. Check error message in bot details

### Documents Not Syncing

1. Verify Google Drive is connected
2. Check folder ID is correct
3. Ensure files are accessible
4. Check document status for errors

### Can't Invite Members

1. Check you have Admin or Owner role
2. Verify team member limit not reached
3. Ensure email is valid

### Billing Issues

1. Use "Manage Billing" for Stripe portal
2. Update payment method if needed
3. Contact support for invoice issues

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Quick search |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Esc` | Close modal |

## Getting Help

- **Documentation**: This guide and linked docs
- **In-App Help**: Click help icon in header
- **Support**: Email support@cluebase.ai
- **GitHub**: Report issues on GitHub
