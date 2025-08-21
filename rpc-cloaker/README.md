# RPC Cloaker System

A high-performance, AI-powered cloaking system with advanced bot detection and traffic management capabilities.

## 🚀 Features

- **RPC Architecture**: Microservice-based architecture for scalability
- **Advanced Bot Detection**: Multi-layer detection with ML-powered analysis
- **Real-time Analytics**: Live traffic monitoring and analysis
- **Smart Routing**: Intelligent traffic distribution
- **ML Pipeline**: Isolated machine learning service for continuous improvement
- **Modern UI**: React-based dashboard with real-time updates

## 📋 Prerequisites

- Node.js v20+
- Python 3.10+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose

## 🛠️ Tech Stack

### Backend
- Fastify + TypeScript
- PostgreSQL + TimescaleDB
- Redis Cluster
- JWT Authentication

### Frontend
- React 18 + TypeScript
- Vite
- Shadcn/ui + Tailwind CSS
- Zustand + React Query

### ML Service
- Python + TensorFlow/PyTorch
- Isolated Docker container
- Real-time model training

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd rpc-cloaker

# Install dependencies
npm run install:all

# Setup databases
npm run db:setup

# Start development
npm run dev
```

## 🐳 Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 Documentation

Detailed documentation is available in the `/docs` directory.

## 📄 License

Proprietary - All rights reserved