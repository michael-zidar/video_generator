#!/bin/bash

# CourseVideo Studio - Initialization Script
# This script starts both the frontend and backend servers

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting CourseVideo Studio..."

# Check for .env files and create from templates if missing
if [ ! -f "$PROJECT_DIR/server/.env" ]; then
  if [ -f "$PROJECT_DIR/server/env.template" ]; then
    echo "Creating server/.env from template..."
    cp "$PROJECT_DIR/server/env.template" "$PROJECT_DIR/server/.env"
    echo "⚠️  Please edit server/.env and add your API keys!"
  fi
fi

if [ ! -f "$PROJECT_DIR/frontend/.env" ]; then
  if [ -f "$PROJECT_DIR/frontend/env.template" ]; then
    echo "Creating frontend/.env from template..."
    cp "$PROJECT_DIR/frontend/env.template" "$PROJECT_DIR/frontend/.env"
  fi
fi

# Create data directories if they don't exist
mkdir -p "$PROJECT_DIR/data/assets"
mkdir -p "$PROJECT_DIR/data/renders"
mkdir -p "$PROJECT_DIR/data/cache"

# Kill any existing processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend server
echo "Starting backend server on port 3001..."
cd "$PROJECT_DIR/server"
npm start &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 3

# Start frontend server
echo "Starting frontend server on port 5173..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "CourseVideo Studio is running!"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3001"
echo "Health:   http://localhost:3001/api/health"
echo ""
echo "Demo credentials:"
echo "  Email: demo@example.com"
echo "  Password: demo123"
echo ""
echo "AI Features (optional):"
echo "  Edit server/.env to add API keys for:"
echo "  - OpenAI (text generation, script writing)"
echo "  - ElevenLabs (voice generation)"
echo ""
echo "Documentation: docs/USER_GUIDE.md"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
