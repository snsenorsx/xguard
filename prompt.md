VAR OLAN VE ÇALIŞAN PROJELERİ BOZMA.

# Kapsamlı RPC Cloaker Sistemi Geliştirme Dokümantasyonu

## Teknoloji Stack

### Backend
- **Core:** Node.js + Fastify (yüksek performans için) + TypeScript
- **Database:** PostgreSQL (ana veri) + TimescaleDB (zaman serisi veriler)
- **Cache:** Redis Cluster + Redis Streams
- **ML Pipeline:** Python (TensorFlow/PyTorch) - İzole container'da

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **State:** Zustand + React Query v5
- **UI:** Shadcn/ui + Tailwind CSS (2025 modern tasarım)

## Ana Sistem Özellikleri

### 1. Core Cloaking Engine
- **RPC Architecture:** Remote Procedure Call tabanlı mikro servis mimarisi
- **Dual Page System:** Money Page & Safe Page dinamik sunumu
- **Smart Routing:**
  - 302/301 Redirect seçenekleri
  - JavaScript redirect
  - Meta refresh redirect
  - Direct render (redirect olmadan)
- **Traffic Distribution:** Otomatik akıllı yönlendirme

### 2. Advanced Bot Detection System
- **Multi-Layer Detection:**
  - Browser fingerprinting (özel algoritma)
  - Network analysis (VPN/Proxy/Datacenter detection)
  - Behavioral patterns (mouse, keyboard, scroll)
  - Canvas fingerprinting
  - WebGL fingerprinting
  - Audio context fingerprinting
- **Real-time Decision:** <3ms yanıt süresi
- **Detection Methods:**
  - User-Agent analysis
  - Header inspection
  - TLS/JA3 fingerprinting
  - TCP/IP stack analysis

### 3. Arka Plan ML Eğitim Sistemi (İzole)
```yaml
ML Pipeline Architecture:
  - Veri Toplama: Ana sistemden ayrı queue ile
  - Model Eğitimi: 
    - Her 6 saatte bir otomatik eğitim
    - A/B test ile yeni model performans testi
    - Gradual rollout (kademeli geçiş)
  - Özellikler:
    - Bot pattern recognition
    - Traffic anomaly detection
    - Click fraud prevention
    - User behavior clustering
  - İzolasyon:
    - Ayrı Docker container
    - Ayrı resource allocation
    - Failover mekanizması
    - Ana sistemi etkilemez
```

### 4. Targeting & Filtering System
- **Geographic:** Ülke, şehir, bölge, ZIP code
- **Device:** Desktop, mobile, tablet, TV
- **Technical:** Browser, OS, dil, ekran çözünürlüğü
- **Network:** ISP, ASN, connection type
- **Temporal:** Saat, gün, tarih aralıkları
- **Custom Rules:** Regex ve logic based kurallar

### 5. Campaign Management
- **Stream Management:**
  - Unlimited streams per campaign
  - Stream priority settings
  - Weight-based distribution
- **Advanced Features:**
  - A/B/n testing
  - Dynamic parameter passing
  - UTM tracking
  - Conversion tracking
  - Postback URL support
- **Automation:**
  - Rule-based actions
  - Auto-pause on threshold
  - Budget management

### 6. Real-Time Analytics Dashboard
- **Live Metrics:**
  - Aktif ziyaretçi sayısı
  - Kabul/red oranları
  - Coğrafi dağılım (interaktif harita)
  - Device/Browser breakdown
- **Historical Data:**
  - Zaman serisi grafikleri
  - Karşılaştırmalı analizler
  - Trend analizi
  - Anomali detection alerts
- **Export Options:**
  - CSV, JSON, PDF
  - Scheduled reports
  - API data access

### 7. User & Access Management
- **Multi-tenant Architecture:**
  - İzole kullanıcı verileri
  - Custom domain support
  - White-label options
- **Permission System:**
  - Granular permissions
  - Role templates
  - API scope management
- **Authentication:**
  - JWT based auth
  - Session management
  - Remember me functionality

### 8. Performance Optimizasyonları
```javascript
Performance Targets:
- Response Time: < 5ms (p99)
- Throughput: 30,000+ RPS
- Bot Detection: < 3ms
- Cache Hit Ratio: > 95%

Optimization Features:
- Connection pooling
- Query optimization
- Smart caching strategies
- Async processing
- Worker threads
```

### 9. API & Integrations
- **RESTful API v2:**
  - OpenAPI 3.0 specification
  - GraphQL endpoint (opsiyonel)
  - WebSocket for real-time data
- **Webhooks:**
  - Event-driven notifications
  - Retry mechanism
  - Signature verification
- **Third-party Integrations:**
  - Traffic source APIs
  - Analytics platforms
  - CDN integration
  - DNS providers

### 10. Modern UI/UX (2025 Design)
```css
Design Principles:
- Glassmorphism effects
- Smooth animations (Framer Motion)
- Dark mode default
- Adaptive layouts
- Micro-interactions
- Real-time updates without refresh
- Command palette (CMD+K)
- Keyboard shortcuts
```

## Teknik Implementasyon Detayları

### Backend Mimarisi
```typescript
// Fastify server with plugins
- fastify-cors
- fastify-jwt
- fastify-websocket
- fastify-redis
- fastify-postgres
- fastify-multipart

// Microservices
- Detection Service (bot detection)
- Analytics Service (data processing)
- ML Service (Python, isolated)
- Cache Service (Redis management)
```

### Database Şeması
```sql
Core Tables:
- users (with RBAC)
- campaigns
- streams
- traffic_logs (partitioned)
- detection_results
- ml_training_data (isolated)
- configurations
- activity_logs

Indexes:
- Optimized for time-series queries
- Composite indexes for filtering
- Partial indexes for active records
```

### ML Pipeline (İzole Sistem)
```python
# Ayrı container'da çalışan ML sistemi
Features:
- Feature extraction pipeline
- Model versioning
- A/B testing framework
- Shadow mode deployment
- Automated retraining
- Performance monitoring
- Rollback capability

Models:
- XGBoost for bot detection
- LSTM for sequence analysis
- Isolation Forest for anomaly
- K-means for user clustering
```

### Deployment Architecture
```yaml
Infrastructure:
  Application:
    - Docker Compose setup
    - Container orchestration
    - Auto-restart policies
    - Health checks
  
  Database:
    - PostgreSQL with replication
    - Redis cluster mode
    - Automated backups
    - Connection pooling
  
  ML Pipeline:
    - Separate container
    - GPU support (optional)
    - Model registry
    - Experiment tracking (MLflow)
  
  Monitoring:
    - Performance metrics
    - Custom dashboards
    - Alert system
    - Log aggregation
```

## Özel Özellikler

### Smart Caching System
- Redis cluster for distributed caching
- Cache warming strategies
- TTL based on traffic patterns
- Intelligent cache invalidation

### Traffic Quality Analysis
- Automatic traffic source scoring
- Fraud detection algorithms
- Publisher quality tracking
- Real-time alerting system

### Advanced Reporting
- Custom report builder
- Scheduled email reports
- Data visualization library
- Cohort analysis
- Funnel analysis

### Bot Detection Features
```javascript
Detection Layers:
1. Browser Analysis:
   - User-Agent parsing
   - Navigator properties
   - Screen resolution
   - Plugin detection

2. Behavior Analysis:
   - Mouse movement patterns
   - Click timing
   - Scroll behavior
   - Keyboard interaction

3. Network Analysis:
   - IP reputation
   - Datacenter detection
   - Proxy/VPN detection
   - Geographic anomalies

4. Fingerprinting:
   - Canvas fingerprint
   - WebGL fingerprint
   - Audio context
   - Font detection
```

### Campaign Features
```yaml
Campaign Management:
  Creation:
    - Template system
    - Bulk import
    - Quick duplicate
  
  Optimization:
    - Auto-optimization
    - Split testing
    - Performance alerts
    - Budget pacing
  
  Tracking:
    - Conversion pixels
    - S2S postbacks
    - Revenue tracking
    - ROI calculation
```

### Analytics Engine
```javascript
Real-time Processing:
- Stream processing with Redis Streams
- Time-series data with TimescaleDB
- Aggregation pipelines
- Custom metrics

Visualization:
- Interactive charts
- Heat maps
- Funnel visualization
- Geographic maps
- Custom dashboards
```

## Performance Özel Optimizasyonlar

### Database Optimizasyonları
- Partitioned tables for logs
- Materialized views for reports
- Query result caching
- Index optimization
- Vacuum scheduling

### Caching Stratejisi
```yaml
Multi-layer Cache:
  L1: Application memory
  L2: Redis cache
  L3: CDN cache
  
Cache Policies:
  - LRU eviction
  - Smart TTL
  - Preemptive refresh
  - Cache warming
```

### Async Processing
- Queue system for heavy tasks
- Background job processing
- Event-driven architecture
- Message broker integration

## UI/UX Detayları

### Dashboard Özellikleri
- Drag & drop widgets
- Customizable layouts
- Real-time notifications
- Quick actions menu
- Global search
- Bulk operations

### Responsive Design
- Mobile-first approach
- Touch-friendly controls
- Adaptive layouts
- Progressive web app

### User Experience
- Onboarding wizard
- Interactive tutorials
- Contextual help
- Keyboard navigation
- Undo/Redo support

## Sistem Gereksinimleri

### Minimum Requirements
```yaml
Server:
  CPU: 4 cores
  RAM: 8GB
  Storage: 100GB SSD
  
Database:
  PostgreSQL: v14+
  Redis: v7+
  
Runtime:
  Node.js: v20+
  Python: 3.10+
```

### Recommended Setup
```yaml
Server:
  CPU: 8+ cores
  RAM: 16GB+
  Storage: 500GB NVMe
  
Performance:
  - Dedicated database server
  - Redis cluster (3+ nodes)
  - Load balancer
  - CDN integration
```

Bu sistem, modern cloaking ihtiyaçlarını karşılayan, yüksek performanslı ve sürekli kendini geliştiren bir platform olacak. ML sistemi tamamen izole çalışarak ana sistemin performansını etkilemeyecek.
