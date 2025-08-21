#!/bin/bash

set -e

echo "🚀 RPC Cloaker Production Deployment"
echo "===================================="

# Check if running as root (recommended for production)
if [ "$EUID" -ne 0 ]; then 
   echo "⚠️  Warning: Not running as root. Some operations may fail."
fi

# Load environment
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "❌ .env.production file not found!"
    exit 1
fi

# Build images
echo "Building Docker images..."
docker-compose build --no-cache

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down

# Start services
echo "Starting production services..."
docker-compose up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Check service health
echo "Checking service health..."

# Backend health check
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    docker-compose logs backend
    exit 1
fi

# Frontend health check
if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend health check failed"
    docker-compose logs frontend
    exit 1
fi

# ML Service health check
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ ML Service is healthy"
else
    echo "❌ ML Service health check failed"
    docker-compose logs ml-service
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "Services running at:"
echo "  Frontend:   https://your-domain.com"
echo "  Backend:    https://your-domain.com/api"
echo "  ML Service: Internal only"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop:      docker-compose down"