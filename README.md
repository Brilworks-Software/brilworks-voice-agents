# Brilworks Voice Agents

A Next.js application featuring AI-powered voice agents for multiple industries using Google's Gemini API. Now with **Custom Voice Agents Platform** - create and manage your own custom AI voice agents!

## Features

### Built-in Features

- 🎙️ Real-time voice conversations with AI agents
- 🌍 Multi-language support (14 languages)
- 🏢 Industry-specific agents (16 industries)
- 📊 Admin console for lead management
- 💾 Local storage for leads and preferences
- 🎨 Modern UI with Tailwind CSS

### 🆕 Custom Voice Agents Platform

- 🔐 User authentication (Sign up / Login)
- ⚡ Create custom voice agents with your own configuration
- 🎯 Personalized agent behavior and system prompts
- 📝 Manage multiple custom agents
- 💬 Launch and use your custom agents in voice sessions
- 🗄️ Supabase backend for data persistence
- 🔒 Row-level security for data isolation
- 📈 Conversation history and lead capture

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Google Gemini API key
- **[For Custom Agents]** A Supabase account (free tier available)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory and add your API keys:

```
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key-here

# For Custom Agents Platform (optional)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here
```

3. **[For Custom Agents]** Setup Supabase database:
   - Create tables using `DATABASE_SETUP.sql`
   - See `CUSTOM_AGENTS_SETUP.md` for detailed instructions

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
  app/
    auth/                    # [NEW] Authentication pages
      login/page.js          # Login page
      signup/page.js         # Signup page
    dashboard/               # [NEW] Custom agents dashboard
      layout.js              # Dashboard layout
      page.js                # Agent list
      create-agent/          # Create agent page
      agent/[id]/            # Launch agent page
      agents/[id]/edit/      # Edit agent page
    components/
      VoiceAgents/
        VoiceAgents.js       # Main component
        VoiceSession.js      # Voice session handler
        Header.js            # Navigation header [Modified with auth]
        Sidebar.js           # Data sidebar
        AdminConsole.js      # Admin dashboard
        IndustryCard.js     # Industry selection card
        constants.js         # Industries and languages data
        services/
          audioUtils.js      # Audio encoding/decoding utilities
    globals.css              # Global styles
    layout.js                # Root layout
    page.js                  # Home page
  services/                  # [NEW] Service layer
    authService.js           # Authentication service
    customAgentsService.js   # Custom agents CRUD
    customAgentSessionWrapper.js  # Agent session configuration
  lib/                       # [NEW] Utilities
    supabase/
      client.js              # Supabase client setup
      server.js              # Supabase server setup
    auth/
      protectedRoute.js      # Auth HOC and hooks
DATABASE_SETUP.sql           # [NEW] Database schema
CUSTOM_AGENTS_SETUP.md       # [NEW] Setup guide
DEVELOPER_GUIDE.md           # [NEW] Developer documentation
IMPLEMENTATION_SUMMARY.md    # [NEW] Implementation details
```

## Using the Application

### Built-in Agents (No Login Required)

1. Visit http://localhost:3000
2. Select an industry from the available options
3. Choose a language
4. Click on an agent to start a voice conversation
5. Use the admin console to view captured leads

### Custom Agents Platform (Login Required)

1. Click "Sign Up" in the header to create an account
2. Login with your credentials
3. Click "Dashboard" to manage your custom agents
4. Click "Create New Agent" to build a custom voice agent:
   - Enter agent name and select industry
   - Choose voice persona (Professional, Friendly, Sales Expert, etc.)
   - Write a custom system prompt defining agent behavior
   - Select language and enable services
   - Configure tools (capture information, log to CRM)
5. Click "Launch" on any agent to start a voice conversation
6. Edit or delete agents as needed

## Custom Agent Configuration

### Agent Settings

- **Agent Name**: Identify your agent
- **Industry**: Categorize by business domain
- **Voice Persona**: Define the personality
  - Professional
  - Friendly
  - Sales Expert
  - Customer Support
  - Consultant
- **System Prompt**: Custom instructions for agent behavior
- **Language**: Select from 14 supported languages
- **Services**: Enable capabilities like booking appointments, FAQs, lead qualification
- **Tools**: Enable information capture and CRM logging

## Available Industries

- Software Development
- Real Estate
- Healthcare
- Beauty & Aesthetics
- Home Services
- Banking & Finance
- Insurance
- Logistics
- Travel
- Automotive
- Legal Services
- HR & Recruitment
- E-commerce
- Education
- Restaurant

## Technologies Used

- Next.js 14
- React 18
- Tailwind CSS
- Google Gemini API (@google/genai)
- **[NEW]** Supabase (Authentication & Database)
- **[NEW]** PostgreSQL (via Supabase)

## Documentation

- **[CUSTOM_AGENTS_SETUP.md](./CUSTOM_AGENTS_SETUP.md)** - Complete setup guide for the custom agents platform
- **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** - Developer documentation and API usage
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation details and architecture
- **[DATABASE_SETUP.sql](./DATABASE_SETUP.sql)** - SQL scripts for database setup

## API Keys Setup

### Google Gemini API Key

1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add to `.env.local` as `NEXT_PUBLIC_GEMINI_API_KEY`

### Supabase Setup (For Custom Agents)

1. Create account at https://supabase.com
2. Create a new project
3. Get credentials:
   - Go to Settings → API
   - Copy Project URL and Anon Key
4. Create database tables using `DATABASE_SETUP.sql`
5. See [CUSTOM_AGENTS_SETUP.md](./CUSTOM_AGENTS_SETUP.md) for detailed instructions

## Security Notes

- ✅ Row Level Security (RLS) enabled on all custom agent tables
- ✅ Users can only access their own agents and conversations
- ✅ Service key should never be exposed in frontend code
- ✅ All sensitive credentials in environment variables
- ✅ Authentication required for custom agent features

## Troubleshooting

### Built-in Agents Not Working

- Check that `NEXT_PUBLIC_GEMINI_API_KEY` is set in `.env.local`
- Restart the dev server after adding environment variables
- Verify API key is valid at Google AI Studio

### Custom Agents Not Working

- Verify Supabase credentials in `.env.local`
- Check database tables are created (see `DATABASE_SETUP.sql`)
- Ensure RLS policies are enabled
- Check browser console for errors
- See [Troubleshooting section in CUSTOM_AGENTS_SETUP.md](./CUSTOM_AGENTS_SETUP.md#troubleshooting)

## Contributing

This is a private project for Brilworks. For questions or support, contact the development team.

## Future Roadmap

### Phase 1 (Completed)

- ✅ Built-in industry agents
- ✅ User authentication
- ✅ Custom agent creation and management
- ✅ Agent launch and voice sessions
- ✅ Conversation history storage

### Phase 2 (Planned)

- 📋 Agent templates marketplace
- 📋 Advanced analytics and reporting
- 📋 Call transcripts and recordings
- 📋 Agent performance metrics

### Phase 3 (Future)

- 📋 Knowledge base uploads
- 📋 Custom tools and integrations
- 📋 CRM system integrations
- 📋 Multi-team support
- 📋 Agent versioning
- 📋 Voice selection customization

## License

Private - Brilworks
