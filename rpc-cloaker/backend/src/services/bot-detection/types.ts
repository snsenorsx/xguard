/**
 * Bot Detection Types and Interfaces
 */

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number; // 0-1
  type?: string;
  reason: string;
  details: {
    userAgentScore: number;
    headerScore: number;
    networkScore: number;
    fingerprintScore: number;
    headlessScore: number;
    behaviorScore: number;
  };
  flags: string[];
}

export interface AnalyzerResult {
  score: number; // 0-1
  confidence: number; // 0-1
  flags: string[];
  details?: Record<string, any>;
}

export interface DetectorResult {
  detected: boolean;
  confidence: number; // 0-1
  type?: string;
  indicators: string[];
}

export interface RequestContext {
  url: string;
  headers: Record<string, string>;
  fingerprint?: any;
  campaignId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface BotDetectionConfig {
  enabled: boolean;
  thresholds: {
    bot: number; // 0-1
    suspicious: number; // 0-1
  };
  weights: {
    userAgent: number;
    headers: number;
    network: number;
    fingerprint: number;
    headless: number;
    behavior: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}