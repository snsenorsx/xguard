# RPC Cloaker Başlatma Rehberi

## 🚀 Hızlı Başlangıç

Sistem tamamen hazır, sadece veritabanı ve Redis servisleri başlatılmalı.

### Opsiyon 1: Docker ile Başlatma (Önerilen)

```bash
# PostgreSQL + TimescaleDB
docker run -d --name rpc-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=rpc_cloaker \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg14

# Redis
docker run -d --name rpc-redis \
  -p 6379:6379 \
  redis:7-alpine

# Backend'i başlat
cd backend
npm run dev

# Frontend'i başlat (yeni terminal)
cd frontend
npm run dev
```

### Opsiyon 2: Docker Compose ile Başlatma

```bash
# Development environment'ı başlat
docker-compose -f docker-compose.dev.yml up -d

# Backend'i başlat
cd backend
npm run dev

# Frontend'i başlat
cd frontend
npm run dev
```

### Opsiyon 3: Local PostgreSQL Kurulumu

Eğer PostgreSQL sisteminizde kuruluysa:

```bash
# PostgreSQL servisini başlat
sudo systemctl start postgresql
# veya
sudo service postgresql start
# veya macOS için
brew services start postgresql

# Database oluştur
createdb rpc_cloaker

# Redis'i başlat
redis-server

# Backend'i başlat
cd backend
npm run dev
```

## 🔍 Sistem Durumu

**Kod Durumu:** ✅ %100 Hazır
- Tüm route'lar implement edildi
- `/api/detect` endpoint'i eklendi
- TypeScript hataları düzeltildi
- Build başarılı

**Eksik Olan:** Sadece database ve Redis servisleri

## 📡 API Endpoints

Server başladıktan sonra şu endpoint'ler çalışacak:

- `GET http://localhost:3000/health` - Health check
- `POST http://localhost:3000/api/detect` - Bot detection
- `GET http://localhost:3000/api/blacklist` - Blacklist yönetimi
- `GET http://localhost:3000/api/threat-intelligence/analyze/:ip` - IP analizi

## 🧪 Test Etme

```bash
# Health check
curl http://localhost:3000/health

# Bot detection test
curl -X POST http://localhost:3000/api/detect \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "headers": {
      "user-agent": "Mozilla/5.0..."
    }
  }'
```

## ⚠️ Not

Eğer "Database not initialized" hatası alırsanız, PostgreSQL'in 5432 portunda çalıştığından emin olun:

```bash
# PostgreSQL bağlantısını test et
nc -zv localhost 5432
# veya
telnet localhost 5432
```