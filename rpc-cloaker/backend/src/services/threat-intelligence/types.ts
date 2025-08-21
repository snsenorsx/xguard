/**
 * Threat Intelligence Types and Interfaces
 */

export interface ThreatIntelligenceResult {
  ipAddress: string;
  isMalicious: boolean;
  isThreat: boolean;
  confidence: number; // 0-100
  reason?: string;
  sources: ThreatSource[];
  categories: string[];
  lastChecked: Date;
  cached: boolean;
}

export interface ThreatSource {
  name: string;
  score: number; // 0-100
  categories: string[];
  details: any;
  reliable: boolean;
  timestamp: Date;
}

export interface ThreatProviderResult {
  provider: string;
  success: boolean;
  data?: any;
  error?: string;
  cached: boolean;
}

export interface IPAnalysisResult {
  ipAddress: string;
  isValid: boolean;
  isPrivate: boolean;
  isReserved: boolean;
  version: 4 | 6;
  asn?: string;
  country?: string;
  isp?: string;
  datacenter?: boolean;
}

export interface ThreatIntelligenceConfig {
  providers: {
    abuseIPDB?: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      rateLimit: number;
      confidenceThreshold: number;
    };
    // Future providers can be added here
    ipQualityScore?: {
      enabled: boolean;
      apiKey: string;
    };
    proxyCheck?: {
      enabled: boolean;
      apiKey: string;
    };
  };
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    namespace: string;
  };
  scoring: {
    weights: {
      [provider: string]: number; // 0-1
    };
    minimumConfidence: number; // 0-100
    autoBlacklistThreshold: number; // 0-100
  };
  fallbackBehavior: 'allow' | 'block';
}

// Provider specific types
export interface AbuseIPDBResponse {
  data: {
    ipAddress: string;
    isPublic: boolean;
    ipVersion: number;
    isWhitelisted: boolean;
    abuseConfidenceScore: number;
    countryCode: string;
    usageType: string;
    isp: string;
    domain: string;
    totalReports: number;
    numDistinctUsers: number;
    lastReportedAt: string;
    reports?: Array<{
      reportedAt: string;
      comment: string;
      categories: number[];
      reporterId: number;
      reporterCountryCode: string;
      reporterCountryName: string;
    }>;
  };
}

export interface AbuseIPDBCategory {
  id: number;
  name: string;
  description: string;
}