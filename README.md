# Brilworks Voice Agents

A Next.js application featuring AI-powered voice agents for multiple industries using Google's Gemini API.

## Features

- 🎙️ Real-time voice conversations with AI agents
- 🌍 Multi-language support (14 languages)
- 🏢 Industry-specific agents (16 industries)
- 📊 Admin console for lead management
- 💾 Local storage for leads and preferences
- 🎨 Modern UI with Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Google Gemini API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory and add your Gemini API key:
```
NEXT_PUBLIC_GEMINI_API_KEY=paste your actual api key here
```

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
    components/
      VoiceAgents/
        VoiceAgents.js       # Main component
        VoiceSession.js      # Voice session handler
        Header.js            # Navigation header
        Sidebar.js           # Data sidebar
        AdminConsole.js      # Admin dashboard
        IndustryCard.js     # Industry selection card
        constants.js         # Industries and languages data
        services/
          audioUtils.js      # Audio encoding/decoding utilities
    globals.css              # Global styles
    layout.js                # Root layout
    page.js                  # Home page
```

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

## License

Private - Brilworks
