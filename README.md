# CourseVideo Studio

An AI-powered presentation and video generator for course creators. Create professional slide decks, generate narration scripts with AI, add voiceovers, and present in fullscreen mode.

## Features

- **Course & Lesson Management** - Organize content into courses and lessons
- **Slide Editor** - Create and edit slides with multiple layouts
- **AI Slide Generation** - Generate slides from topics or notes using OpenAI
- **AI Script Generation** - Create narration scripts for each slide
- **TTS Voiceovers** - Generate professional voice audio with ElevenLabs
- **RevealJS Presentation Mode** - Present slides in fullscreen
- **Export Options** - Export as RevealJS HTML presentations
- **Dark Mode** - Full dark/light theme support
- **Keyboard Shortcuts** - Navigate efficiently with keyboard

## Quick Start

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../server
npm install
```

### 2. Configure Environment

**Frontend (.env)**

Create `frontend/.env`:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

**Backend (.env)**

Create `server/.env`:
```bash
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_key_here

# AI Services
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
GEMINI_API_KEY=...

# Server
PORT=3001
```

See `frontend/.env.example` and `server/.env.example` for complete configuration options.

### 3. Start the Application

```bash
# From project root
./init.sh
```

Or start servers manually:

```bash
# Terminal 1: Start backend
cd server && npm start

# Terminal 2: Start frontend
cd frontend && npm run dev
```

### 4. Access the App

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

Sign up with your email or use social login via Clerk.

## Documentation

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for detailed usage instructions.

## Project Structure

```
video_generator/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── store/       # Zustand state stores
│   │   └── hooks/       # Custom hooks
│   └── ...
├── server/            # Express.js backend
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # AI & TTS services
│   │   └── middleware/  # Auth middleware
│   └── ...
├── data/              # Local storage
│   ├── assets/        # Uploaded files
│   ├── renders/       # Generated videos
│   └── database.sqlite
├── docs/              # Documentation
└── init.sh           # Startup script
```

## API Keys

### Clerk (Authentication) - Required
- Create an account at [clerk.com](https://clerk.com)
- Create a new application
- Get your publishable key (`pk_test_*`) and secret key (`sk_test_*`)
- Add to respective `.env` files

### OpenAI (Text Generation)
- Get an API key from [platform.openai.com](https://platform.openai.com)
- Add to `server/.env` as `OPENAI_API_KEY`

### ElevenLabs (Voice Generation)
- Get an API key from [elevenlabs.io](https://elevenlabs.io)
- Add to `server/.env` as `ELEVENLABS_API_KEY`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:
- Deploying frontend to Vercel
- Deploying backend to Railway/Render/VPS
- Production environment configuration
- Clerk setup for production

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for development and building
- Tailwind CSS 4 for styling
- shadcn/ui components
- Zustand for state management
- RevealJS for presentations

**Backend:**
- Node.js with Express
- SQLite with sql.js
- OpenAI SDK for text generation
- ElevenLabs API for TTS

## License

MIT

