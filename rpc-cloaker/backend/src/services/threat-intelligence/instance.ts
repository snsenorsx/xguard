/**
 * Threat Intelligence Service Instance
 * Provides a single instance of the service
 */

import { ThreatIntelligenceService } from './threat-intelligence.service';
import { ThreatIntelligenceConfig } from './types';

let instance: ThreatIntelligenceService | null = null;

export function getThreatIntelligenceService(
  config?: Partial<ThreatIntelligenceConfig>
): ThreatIntelligenceService {
  if (!instance) {
    const defaultConfig: Partial<ThreatIntelligenceConfig> = {
      providers: {
        abuseIPDB: {
          enabled: !!process.env.ABUSEIPDB_API_KEY,
          apiKey: process.env.ABUSEIPDB_API_KEY || '',
          baseUrl: process.env.ABUSEIPDB_BASE_URL || 'https://api.abuseipdb.com/api/v2',
          rateLimit: parseInt(process.env.ABUSEIPDB_RATE_LIMIT || '1000'),
          confidenceThreshold: parseInt(process.env.ABUSEIPDB_CONFIDENCE_THRESHOLD || '25')
        }
      },
      cache: {
        enabled: process.env.THREAT_CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.THREAT_CACHE_TTL || '3600'),
        namespace: process.env.THREAT_CACHE_NAMESPACE || 'threat'
      },
      scoring: {
        weights: {
          AbuseIPDB: parseFloat(process.env.ABUSEIPDB_WEIGHT || '1.0')
        },
        minimumConfidence: parseInt(process.env.THREAT_MIN_CONFIDENCE || '10'),
        autoBlacklistThreshold: parseInt(process.env.THREAT_AUTO_BLACKLIST || '75')
      },
      fallbackBehavior: (process.env.THREAT_FALLBACK_BEHAVIOR as 'allow' | 'block') || 'allow'
    };

    instance = new ThreatIntelligenceService({
      ...defaultConfig,
      ...config
    });
  }

  return instance;
}

export function resetThreatIntelligenceService(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}