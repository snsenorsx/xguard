import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DB_HOST: z.string(),
  DB_PORT: z.string().transform(Number),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_SSL: z.string().transform(val => val === 'true').default('false'),
  TIMESCALE_DB_NAME: z.string(),
  
  // Redis
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  REDIS_CLUSTER_NODES: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // ML Service
  ML_SERVICE_URL: z.string(),
  ML_SERVICE_API_KEY: z.string(),
  
  // Bot Detection
  BOT_DETECTION_ENABLED: z.string().transform(val => val === 'true').default('true'),
  BOT_DETECTION_THRESHOLD: z.string().transform(Number).default('0.8'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('1000'),
  RATE_LIMIT_TIMEWINDOW: z.string().transform(Number).default('60000'),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  
  // Queue
  QUEUE_REDIS_HOST: z.string().optional(),
  QUEUE_REDIS_PORT: z.string().transform(Number).optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  
  database: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    timescaleDb: env.TIMESCALE_DB_NAME,
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    clusterNodes: env.REDIS_CLUSTER_NODES?.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    }),
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  
  cors: {
    origin: env.CORS_ORIGIN,
  },
  
  logging: {
    level: env.LOG_LEVEL,
  },
  
  mlService: {
    url: env.ML_SERVICE_URL,
    apiKey: env.ML_SERVICE_API_KEY,
  },
  
  botDetection: {
    enabled: env.BOT_DETECTION_ENABLED,
    threshold: env.BOT_DETECTION_THRESHOLD,
  },
  
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIMEWINDOW,
  },
  
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
  },
  
  queue: {
    redis: {
      host: env.QUEUE_REDIS_HOST || env.REDIS_HOST,
      port: env.QUEUE_REDIS_PORT || env.REDIS_PORT,
    },
  },
};