#!/bin/bash

set -e

echo "🚀 RPC Cloaker Setup Script"
echo "=========================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose"
    exit 1
fi

echo "✅ All prerequisites met"

# Create environment files
echo "Creating environment files..."

if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
fi

if [ ! -f frontend/.env ]; then
    cp frontend/.env.example frontend/.env
    echo "✅ Created frontend/.env"
fi

if [ ! -f ml-service/.env ]; then
    cp ml-service/.env.example ml-service/.env
    echo "✅ Created ml-service/.env"
fi

# Install dependencies
echo "Installing dependencies..."

echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend && npm install && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "✅ All dependencies installed"

# Start development environment
echo "Starting development environment..."

# Start databases
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "Waiting for databases to be ready..."
sleep 10

# Initialize database
echo "Initializing database..."
cd backend
npm run db:setup
cd ..

echo "✅ Database initialized"

# Start ML service
docker-compose -f docker-compose.dev.yml up -d ml-service

echo "✅ Development environment is ready!"
echo ""
echo "To start the application:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Services:"
echo "  Backend:    http://localhost:3000"
echo "  Frontend:   http://localhost:5173"
echo "  ML Service: http://localhost:5000"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:      localhost:6379"