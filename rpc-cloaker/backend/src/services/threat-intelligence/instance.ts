/**
 * Threat Intelligence Service Instance
 */

import { ThreatIntelligenceService } from './threat-intelligence.service';

let instance: ThreatIntelligenceService | null = null;

export function getThreatIntelligenceService(): ThreatIntelligenceService {
  if (!instance) {
    instance = new ThreatIntelligenceService({
      providers: {
        abuseIPDB: {
          enabled: !!process.env.ABUSEIPDB_API_KEY,
          apiKey: process.env.ABUSEIPDB_API_KEY || '',
          baseUrl: 'https://api.abuseipdb.com/api/v2',
          rateLimit: 1000,
          confidenceThreshold: 25
        }
      }
    });
  }
  return instance;
}