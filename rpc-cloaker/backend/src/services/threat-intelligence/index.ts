/**
 * Threat Intelligence Service - Main Entry Point
 * Modular architecture for threat intelligence sources
 */

export { ThreatIntelligenceService } from './threat-intelligence.service';
export { AbuseIPDBProvider } from './providers/abuseipdb.provider';
export { IPAnalyzer } from './analyzers/ip.analyzer';
export { ThreatScorer } from './scorers/threat.scorer';
export { ThreatCache } from './cache/threat.cache';
export { getThreatIntelligenceService } from './instance';

export type {
  ThreatIntelligenceResult,
  ThreatSource,
  ThreatProviderResult,
  ThreatIntelligenceConfig,
  IPAnalysisResult
} from './types';