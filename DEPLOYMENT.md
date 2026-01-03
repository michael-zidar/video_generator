# Deployment Guide

This guide covers deploying the CourseVideo Studio application with Clerk authentication.

## Architecture

- **Frontend**: React + Vite application deployed to Vercel
- **Backend**: Node.js + Express API (requires separate deployment)
- **Authentication**: Clerk

## Prerequisites

1. A [Clerk](https://clerk.com) account
2. A [Vercel](https://vercel.com) account
3. A hosting service for the backend (Railway, Render, or any Node.js host)

## Step 1: Set Up Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application
3. Get your API keys from the API Keys page:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

## Step 2: Configure Environment Variables

### Frontend (.env)

```bash
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Backend (.env)

```bash
# Clerk
CLERK_SECRET_KEY=your_clerk_secret_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_DEFAULT_VOICE_ID=your_default_voice_id

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3001
```

## Step 3: Deploy Backend

The backend requires WebSocket support for real-time render progress, so it cannot be deployed as a serverless function on Vercel. Recommended options:

### Option A: Railway

1. Create a new project on [Railway](https://railway.app/)
2. Connect your GitHub repository
3. Select the `server` directory as the root
4. Add all environment variables from `.env.example`
5. Deploy

### Option B: Render

1. Create a new Web Service on [Render](https://render.com/)
2. Connect your GitHub repository
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add all environment variables
5. Deploy

### Option C: Any VPS (DigitalOcean, AWS, etc.)

1. SSH into your server
2. Clone the repository
3. Install dependencies: `cd server && npm install`
4. Create `.env` file with required variables
5. Use PM2 or similar to run: `pm2 start src/index.js --name coursevideo-api`

## Step 4: Deploy Frontend to Vercel

### Method 1: Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (the vercel.json handles the frontend directory)
5. Add environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key
6. Deploy

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Step 5: Update Frontend API URL

After deploying your backend, update the frontend to use the production API URL:

1. Create `frontend/.env.production`:
```bash
VITE_API_URL=https://your-backend-url.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
```

2. Update API calls in your frontend code to use `import.meta.env.VITE_API_URL`

## Step 6: Configure Clerk for Production

1. Go to Clerk Dashboard → Settings → Domains
2. Add your Vercel production domain (e.g., `your-app.vercel.app`)
3. Switch to production API keys (`pk_live_*` and `sk_live_*`)
4. Update environment variables in both Vercel and your backend host

## Step 7: Test the Deployment

1. Visit your Vercel URL
2. Try signing up/logging in with Clerk
3. Verify the frontend can communicate with the backend
4. Test render functionality and WebSocket connection

## Environment-Specific Configuration

### Development
- Use `pk_test_*` keys from Clerk
- Backend runs on `localhost:3001`
- Frontend runs on `localhost:5173`

### Preview (Staging)
- Use `pk_test_*` keys from Clerk
- Configure preview environment in Vercel
- Point to staging backend URL

### Production
- Use `pk_live_*` keys from Clerk
- Custom domain configured in Clerk
- Production backend URL

## Troubleshooting

### Authentication Issues
- Verify Clerk publishable key is correct
- Check that your domain is added in Clerk Dashboard
- Ensure you're using the correct environment keys (test vs. live)

### API Connection Issues
- Verify backend is running and accessible
- Check CORS configuration in backend
- Ensure environment variables are set correctly

### WebSocket Issues
- WebSockets require a persistent server (not serverless)
- Verify your backend host supports WebSocket connections
- Check firewall/security group settings

## Security Checklist

- [ ] Never commit `.env` files to version control
- [ ] Use production keys in production environment
- [ ] Configure CORS properly on backend
- [ ] Enable HTTPS on all deployments
- [ ] Regularly rotate API keys
- [ ] Set up monitoring and error tracking

## Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Render Documentation](https://render.com/docs)
