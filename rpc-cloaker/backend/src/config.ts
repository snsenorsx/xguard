/**
 * Application Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*'
    }
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  
  isDevelopment: process.env.NODE_ENV === 'development',
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760')
  },
  
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000')
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'rpc_cloaker',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    database: process.env.DB_NAME || 'rpc_cloaker',
    timescaleDb: process.env.TIMESCALE_DB_NAME || 'rpc_cloaker'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB || '0'),
    db: parseInt(process.env.REDIS_DB || '0'),
    cluster: process.env.REDIS_CLUSTER_NODES ? 
      process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port) };
      }) : undefined,
    clusterNodes: process.env.REDIS_CLUSTER_NODES ? 
      process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port) };
      }) : undefined
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:5000',
    apiKey: process.env.ML_SERVICE_API_KEY || 'dev_key'
  },
  
  botDetection: {
    enabled: process.env.BOT_DETECTION_ENABLED !== 'false',
    threshold: parseFloat(process.env.BOT_DETECTION_THRESHOLD || '0.8')
  },
  
  threatIntelligence: {
    abuseIPDB: {
      apiKey: process.env.ABUSEIPDB_API_KEY || '',
      enabled: !!process.env.ABUSEIPDB_API_KEY
    },
    virusTotal: {
      apiKey: process.env.VIRUSTOTAL_API_KEY || '',
      enabled: !!process.env.VIRUSTOTAL_API_KEY
    }
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1
    }
  }
};