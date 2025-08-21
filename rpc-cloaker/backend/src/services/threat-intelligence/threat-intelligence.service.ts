/**
 * Threat Intelligence Service
 * Orchestrates threat intelligence providers and analysis
 */

import { 
  ThreatIntelligenceResult,
  ThreatIntelligenceConfig,
  ThreatSource
} from './types';
import { AbuseIPDBProvider } from './providers/abuseipdb.provider';
import { IPAnalyzer } from './analyzers/ip.analyzer';
import { ThreatScorer } from './scorers/threat.scorer';
import { ThreatCache } from './cache/threat.cache';
import { DEFAULT_CONFIG } from './constants';

export class ThreatIntelligenceService {
  private config: ThreatIntelligenceConfig;
  private providers: Map<string, any> = new Map();
  private ipAnalyzer: IPAnalyzer;
  private threatScorer: ThreatScorer;
  private cache: ThreatCache;
  private initialized = false;

  constructor(config?: Partial<ThreatIntelligenceConfig>) {
    this.config = this.mergeConfig(config);
    this.ipAnalyzer = new IPAnalyzer();
    this.threatScorer = new ThreatScorer(this.config.scoring);
    this.cache = new ThreatCache(this.config.cache);
    
    this.initializeProviders();
  }

  /**
   * Analyze IP address for threats
   */
  async analyzeIP(ipAddress: string): Promise<ThreatIntelligenceResult> {
    // Validate IP
    const ipAnalysis = this.ipAnalyzer.analyze(ipAddress);
    if (!ipAnalysis.isValid) {
      return this.createInvalidIPResult(ipAddress);
    }

    // Check for private/reserved IPs
    if (ipAnalysis.isPrivate || ipAnalysis.isReserved) {
      return this.createPrivateIPResult(ipAddress, ipAnalysis);
    }

    // Check cache
    if (this.config.cache.enabled) {
      const cached = this.cache.get(ipAddress);
      if (cached) {
        return cached;
      }
    }

    try {
      // Query all enabled providers
      const sources = await this.queryProviders(ipAddress);
      
      // Calculate threat assessment
      const assessment = this.threatScorer.calculateThreatAssessment(
        ipAddress,
        sources
      );

      const result: ThreatIntelligenceResult = {
        ...assessment,
        lastChecked: new Date(),
        cached: false
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.cache.set(ipAddress, result);
      }

      return result;

    } catch (error) {
      console.error(`Threat intelligence analysis failed for IP ${ipAddress}:`, error);
      return this.createErrorResult(ipAddress);
    }
  }

  /**
   * Analyze IP with specific options
   */
  async analyzeIPWithOptions(
    ipAddress: string,
    options: {
      providers?: string[];
      skipCache?: boolean;
      includeRawData?: boolean;
    } = {}
  ): Promise<ThreatIntelligenceResult> {
    // Skip cache if requested
    if (!options.skipCache && this.config.cache.enabled) {
      const cached = this.cache.get(ipAddress);
      if (cached) {
        return cached;
      }
    }

    // Validate IP
    const ipAnalysis = this.ipAnalyzer.analyze(ipAddress);
    if (!ipAnalysis.isValid) {
      return this.createInvalidIPResult(ipAddress);
    }

    // Query specific providers if requested
    const providers = options.providers || Array.from(this.providers.keys());
    const sources = await this.querySpecificProviders(ipAddress, providers);

    // Calculate assessment
    const assessment = this.threatScorer.calculateThreatAssessment(
      ipAddress,
      sources
    );

    const result: ThreatIntelligenceResult = {
      ...assessment,
      lastChecked: new Date(),
      cached: false
    };

    // Cache if not skipped
    if (!options.skipCache && this.config.cache.enabled) {
      this.cache.set(ipAddress, result);
    }

    return result;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    providers: { [key: string]: any };
    cache: any;
  }> {
    const providerStatus: { [key: string]: any } = {};

    for (const [name, provider] of this.providers.entries()) {
      if (provider.getProviderInfo) {
        providerStatus[name] = provider.getProviderInfo();
      }
    }

    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      providers: providerStatus,
      cache: this.cache.getStats()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ThreatIntelligenceConfig>): void {
    this.config = this.mergeConfig(config);
    this.threatScorer = new ThreatScorer(this.config.scoring);
    
    // Re-initialize providers if needed
    this.initializeProviders();
  }

  /**
   * Initialize providers based on configuration
   */
  private initializeProviders(): void {
    this.providers.clear();

    // Initialize AbuseIPDB if configured
    if (this.config.providers.abuseIPDB?.enabled) {
      const abuseConfig = this.config.providers.abuseIPDB;
      this.providers.set('AbuseIPDB', new AbuseIPDBProvider({
        apiKey: abuseConfig.apiKey,
        baseUrl: abuseConfig.baseUrl,
        rateLimit: abuseConfig.rateLimit,
        enabled: abuseConfig.enabled
      }));
    }

    // Future providers can be added here
    // if (this.config.providers.ipQualityScore?.enabled) { ... }
    // if (this.config.providers.proxyCheck?.enabled) { ... }

    this.initialized = true;
  }

  /**
   * Query all enabled providers
   */
  private async queryProviders(ipAddress: string): Promise<ThreatSource[]> {
    const sources: ThreatSource[] = [];
    const promises: Promise<void>[] = [];

    for (const [name, provider] of this.providers.entries()) {
      promises.push(
        this.queryProvider(provider, ipAddress)
          .then(source => {
            if (source) sources.push(source);
          })
          .catch(error => {
            console.error(`Provider ${name} failed:`, error);
          })
      );
    }

    await Promise.all(promises);
    return sources;
  }

  /**
   * Query specific providers
   */
  private async querySpecificProviders(
    ipAddress: string,
    providerNames: string[]
  ): Promise<ThreatSource[]> {
    const sources: ThreatSource[] = [];
    const promises: Promise<void>[] = [];

    for (const name of providerNames) {
      const provider = this.providers.get(name);
      if (provider) {
        promises.push(
          this.queryProvider(provider, ipAddress)
            .then(source => {
              if (source) sources.push(source);
            })
            .catch(error => {
              console.error(`Provider ${name} failed:`, error);
            })
        );
      }
    }

    await Promise.all(promises);
    return sources;
  }

  /**
   * Query a single provider
   */
  private async queryProvider(provider: any, ipAddress: string): Promise<ThreatSource | null> {
    if (provider.checkIP && provider.processResult) {
      const result = await provider.checkIP(ipAddress);
      if (result.success && result.data) {
        return provider.processResult(result.data);
      }
    }
    return null;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config?: Partial<ThreatIntelligenceConfig>): ThreatIntelligenceConfig {
    return {
      providers: {
        abuseIPDB: {
          enabled: false,
          apiKey: '',
          baseUrl: 'https://api.abuseipdb.com/api/v2',
          rateLimit: 1000,
          confidenceThreshold: 25,
          ...config?.providers?.abuseIPDB
        },
        ...config?.providers
      },
      cache: {
        ...DEFAULT_CONFIG.cache,
        ...config?.cache
      },
      scoring: {
        weights: {
          AbuseIPDB: 1.0,
          ...config?.scoring?.weights
        },
        minimumConfidence: DEFAULT_CONFIG.scoring.minimumConfidence,
        autoBlacklistThreshold: DEFAULT_CONFIG.scoring.autoBlacklistThreshold,
        ...config?.scoring
      },
      fallbackBehavior: config?.fallbackBehavior || DEFAULT_CONFIG.fallbackBehavior
    };
  }

  /**
   * Create result for invalid IP
   */
  private createInvalidIPResult(ipAddress: string): ThreatIntelligenceResult {
    return {
      ipAddress,
      isMalicious: false,
      isThreat: false,
      confidence: 0,
      sources: [],
      categories: [],
      lastChecked: new Date(),
      cached: false,
      reason: 'Invalid IP address format'
    };
  }

  /**
   * Create result for private/reserved IP
   */
  private createPrivateIPResult(ipAddress: string, analysis: any): ThreatIntelligenceResult {
    return {
      ipAddress,
      isMalicious: false,
      isThreat: false,
      confidence: 0,
      sources: [],
      categories: [],
      lastChecked: new Date(),
      cached: false,
      reason: analysis.isPrivate ? 'Private IP address' : 'Reserved IP address'
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(ipAddress: string): ThreatIntelligenceResult {
    const fallback = this.config.fallbackBehavior === 'block';
    
    return {
      ipAddress,
      isMalicious: fallback,
      isThreat: fallback,
      confidence: 0,
      sources: [],
      categories: [],
      lastChecked: new Date(),
      cached: false,
      reason: 'Threat analysis failed'
    };
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    this.cache.destroy();
    this.providers.clear();
    this.initialized = false;
  }
}