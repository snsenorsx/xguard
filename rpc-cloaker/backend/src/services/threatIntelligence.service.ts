/**
 * Threat Intelligence Service
 * AbuseIPDB + VirusTotal integration for advanced IP reputation checking
 * Clean, maintainable, production-ready implementation
 */

import axios, { AxiosInstance } from 'axios';
import { CacheService } from './cache.service';

export interface ThreatIntelligenceResult {
  ipAddress: string;
  isMalicious: boolean;
  confidence: number; // 0-100
  sources: ThreatSource[];
  lastChecked: Date;
  cached: boolean;
}

export interface ThreatSource {
  name: string;
  score: number; // 0-100
  categories: string[];
  details: any;
  reliable: boolean;
}

export interface AbuseIPDBResponse {
  ipAddress: string;
  isPublic: boolean;
  ipVersion: number;
  isWhitelisted: boolean;
  abuseConfidencePercentage: number;
  countryCode: string;
  usageType: string;
  isp: string;
  domain: string;
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt: string;
}

export interface VirusTotalResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      last_analysis_stats: {
        harmless: number;
        malicious: number;
        suspicious: number;
        undetected: number;
        timeout: number;
      };
      last_analysis_results: { [engine: string]: any };
      reputation: number;
      regional_internet_registry: string;
      jarm: string;
      network: string;
      country: string;
      as_owner: string;
      asn: number;
    };
  };
}

export interface ThreatIntelligenceConfig {
  abuseIPDB: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number; // requests per day
    confidenceThreshold: number; // 0-100
  };
  virusTotal: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number; // requests per minute
    maliciousThreshold: number; // minimum malicious votes
  };
  cache: {
    ttl: number; // seconds
    namespace: string;
  };
  scoring: {
    abuseIPDBWeight: number; // 0-1
    virusTotalWeight: number; // 0-1
    minimumConfidence: number; // 0-100
  };
}

/**
 * Threat Intelligence Service
 * Integrates multiple threat intelligence sources for comprehensive IP reputation analysis
 */
export class ThreatIntelligenceService {
  private readonly config: ThreatIntelligenceConfig;
  private readonly cacheService: any;
  private readonly abuseIPDBClient: AxiosInstance;
  private readonly virusTotalClient: AxiosInstance;

  // Rate limiting
  private abuseIPDBRequests = 0;
  private virusTotalRequests = 0;
  private lastAbuseIPDBReset = Date.now();
  private lastVirusTotalReset = Date.now();

  private readonly DEBUG = process.env.NODE_ENV === 'development';

  constructor(config: ThreatIntelligenceConfig, cacheService: any) {
    this.config = config;
    this.cacheService = cacheService;

    // Initialize AbuseIPDB client
    this.abuseIPDBClient = axios.create({
      baseURL: config.abuseIPDB.baseUrl,
      timeout: 10000,
      headers: {
        'Key': config.abuseIPDB.apiKey,
        'Accept': 'application/json'
      }
    });

    // Initialize VirusTotal client
    this.virusTotalClient = axios.create({
      baseURL: config.virusTotal.baseUrl,
      timeout: 15000,
      headers: {
        'x-apikey': config.virusTotal.apiKey,
        'Accept': 'application/json'
      }
    });

    this.setupRequestInterceptors();
  }

  /**
   * Analyze IP address using multiple threat intelligence sources
   */
  async analyzeIP(ipAddress: string): Promise<ThreatIntelligenceResult> {
    if (!this.isValidIP(ipAddress)) {
      throw new Error(`Invalid IP address: ${ipAddress}`);
    }

    const cacheKey = `${this.config.cache.namespace}:threat:${ipAddress}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey, {});
    if (cached) {
      if (this.DEBUG) {
        console.log(`Threat intelligence cache hit for IP: ${ipAddress}`);
      }
      return { ...cached, cached: true };
    }

    try {
      const startTime = Date.now();

      // Query multiple sources in parallel
      const [abuseIPDBResult, virusTotalResult] = await Promise.allSettled([
        this.queryAbuseIPDB(ipAddress),
        this.queryVirusTotal(ipAddress)
      ]);

      // Process results
      const sources: ThreatSource[] = [];
      
      if (abuseIPDBResult.status === 'fulfilled' && abuseIPDBResult.value) {
        sources.push(this.processAbuseIPDBResult(abuseIPDBResult.value));
      }

      if (virusTotalResult.status === 'fulfilled' && virusTotalResult.value) {
        sources.push(this.processVirusTotalResult(virusTotalResult.value));
      }

      // Calculate overall threat assessment
      const assessment = this.calculateThreatAssessment(sources);

      const result: ThreatIntelligenceResult = {
        ipAddress,
        isMalicious: assessment.isMalicious,
        confidence: assessment.confidence,
        sources,
        lastChecked: new Date(),
        cached: false
      };

      // Cache the result
      await this.cacheService.set(
        cacheKey, 
        result, 
        this.config.cache.ttl,
        { tags: [`threat:${ipAddress}`, 'threat_intelligence'] }
      );

      const duration = Date.now() - startTime;
      if (this.DEBUG) {
        console.log(`Threat intelligence analysis completed in ${duration}ms for IP: ${ipAddress}`);
      }

      return result;

    } catch (error) {
      console.error(`Threat intelligence analysis failed for IP ${ipAddress}:`, error);
      
      // Return safe default
      return {
        ipAddress,
        isMalicious: false,
        confidence: 0,
        sources: [],
        lastChecked: new Date(),
        cached: false
      };
    }
  }

  /**
   * Query AbuseIPDB for IP reputation
   */
  private async queryAbuseIPDB(ipAddress: string): Promise<AbuseIPDBResponse | null> {
    if (!this.canMakeAbuseIPDBRequest()) {
      if (this.DEBUG) {
        console.warn('AbuseIPDB rate limit exceeded, skipping query');
      }
      return null;
    }

    try {
      this.abuseIPDBRequests++;
      
      const response = await this.abuseIPDBClient.get('/check', {
        params: {
          ipAddress,
          maxAgeInDays: 90,
          verbose: true
        }
      });

      if (this.DEBUG) {
        console.log(`AbuseIPDB response for ${ipAddress}:`, response.data);
      }

      return response.data;

    } catch (error) {
      console.error(`AbuseIPDB query failed for IP ${ipAddress}:`, error);
      return null;
    }
  }

  /**
   * Query VirusTotal for IP reputation
   */
  private async queryVirusTotal(ipAddress: string): Promise<VirusTotalResponse | null> {
    if (!this.canMakeVirusTotalRequest()) {
      if (this.DEBUG) {
        console.warn('VirusTotal rate limit exceeded, skipping query');
      }
      return null;
    }

    try {
      this.virusTotalRequests++;
      
      const response = await this.virusTotalClient.get(`/ip_addresses/${ipAddress}`);

      if (this.DEBUG) {
        console.log(`VirusTotal response for ${ipAddress}:`, response.data);
      }

      return response.data;

    } catch (error) {
      console.error(`VirusTotal query failed for IP ${ipAddress}:`, error);
      return null;
    }
  }

  /**
   * Process AbuseIPDB response into standardized format
   */
  private processAbuseIPDBResult(data: AbuseIPDBResponse): ThreatSource {
    const categories = this.mapAbuseIPDBCategories(data);
    
    return {
      name: 'AbuseIPDB',
      score: data.abuseConfidencePercentage,
      categories,
      details: {
        isPublic: data.isPublic,
        countryCode: data.countryCode,
        usageType: data.usageType,
        isp: data.isp,
        domain: data.domain,
        totalReports: data.totalReports,
        numDistinctUsers: data.numDistinctUsers,
        lastReportedAt: data.lastReportedAt
      },
      reliable: data.totalReports >= 3 && data.numDistinctUsers >= 2
    };
  }

  /**
   * Process VirusTotal response into standardized format
   */
  private processVirusTotalResult(data: VirusTotalResponse): ThreatSource {
    const stats = data.data.attributes.last_analysis_stats;
    const totalEngines = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;
    const score = totalEngines > 0 ? (stats.malicious + stats.suspicious * 0.5) / totalEngines * 100 : 0;

    const categories = [];
    if (stats.malicious > 0) categories.push('malicious');
    if (stats.suspicious > 0) categories.push('suspicious');
    if (data.data.attributes.reputation < -5) categories.push('bad_reputation');

    return {
      name: 'VirusTotal',
      score: Math.round(score),
      categories,
      details: {
        harmless: stats.harmless,
        malicious: stats.malicious,
        suspicious: stats.suspicious,
        undetected: stats.undetected,
        reputation: data.data.attributes.reputation,
        country: data.data.attributes.country,
        asOwner: data.data.attributes.as_owner,
        asn: data.data.attributes.asn,
        network: data.data.attributes.network
      },
      reliable: totalEngines >= 10 // Consider reliable if scanned by 10+ engines
    };
  }

  /**
   * Calculate overall threat assessment from multiple sources
   */
  private calculateThreatAssessment(sources: ThreatSource[]): { isMalicious: boolean; confidence: number } {
    if (sources.length === 0) {
      return { isMalicious: false, confidence: 0 };
    }

    let totalScore = 0;
    let totalWeight = 0;

    sources.forEach(source => {
      let weight = 0;
      
      // Weight based on source reliability and type
      switch (source.name) {
        case 'AbuseIPDB':
          weight = this.config.scoring.abuseIPDBWeight * (source.reliable ? 1 : 0.5);
          break;
        case 'VirusTotal':
          weight = this.config.scoring.virusTotalWeight * (source.reliable ? 1 : 0.5);
          break;
        default:
          weight = 0.3;
      }

      totalScore += source.score * weight;
      totalWeight += weight;
    });

    const confidence = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const isMalicious = confidence >= this.config.scoring.minimumConfidence;

    return { isMalicious, confidence };
  }

  /**
   * Bulk analyze multiple IP addresses
   */
  async analyzeBulkIPs(ipAddresses: string[]): Promise<ThreatIntelligenceResult[]> {
    if (ipAddresses.length === 0) {
      return [];
    }

    if (this.DEBUG) {
      console.log(`Bulk analyzing ${ipAddresses.length} IP addresses`);
    }

    // Process IPs in batches to respect rate limits
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < ipAddresses.length; i += batchSize) {
      batches.push(ipAddresses.slice(i, i + batchSize));
    }

    const results: ThreatIntelligenceResult[] = [];
    
    for (const batch of batches) {
      const batchPromises = batch.map(ip => this.analyzeIP(ip));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to analyze IP ${batch[index]}:`, result.reason);
          // Add safe default for failed analysis
          results.push({
            ipAddress: batch[index],
            isMalicious: false,
            confidence: 0,
            sources: [],
            lastChecked: new Date(),
            cached: false
          });
        }
      });

      // Rate limiting delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get threat intelligence statistics
   */
  async getStatistics(): Promise<any> {
    const stats = {
      requestsToday: {
        abuseIPDB: this.abuseIPDBRequests,
        virusTotal: this.virusTotalRequests
      },
      rateLimits: {
        abuseIPDB: {
          daily: this.config.abuseIPDB.rateLimit,
          remaining: Math.max(0, this.config.abuseIPDB.rateLimit - this.abuseIPDBRequests)
        },
        virusTotal: {
          perMinute: this.config.virusTotal.rateLimit,
          remaining: Math.max(0, this.config.virusTotal.rateLimit - this.virusTotalRequests)
        }
      },
      cache: {
        namespace: this.config.cache.namespace,
        ttl: this.config.cache.ttl
      },
      scoring: this.config.scoring
    };

    return stats;
  }

  /**
   * Clear threat intelligence cache for specific IP or all
   */
  async clearCache(ipAddress?: string): Promise<void> {
    if (ipAddress) {
      const cacheKey = `${this.config.cache.namespace}:threat:${ipAddress}`;
      await this.cacheService.del(cacheKey);
    } else {
      // Clear all threat intelligence cache
      await this.cacheService.invalidateByTags(['threat_intelligence']);
    }
  }

  /**
   * Check if IP is in internal whitelist
   */
  private isWhitelistedIP(ipAddress: string): boolean {
    const whitelistedRanges = [
      '127.0.0.0/8',    // Localhost
      '10.0.0.0/8',     // Private Class A
      '172.16.0.0/12',  // Private Class B
      '192.168.0.0/16', // Private Class C
      '169.254.0.0/16'  // Link-local
    ];

    // Simple whitelist check (in production, use proper CIDR library)
    return whitelistedRanges.some(range => {
      if (range.includes('/')) {
        const [network] = range.split('/');
        return ipAddress.startsWith(network.split('.').slice(0, -1).join('.'));
      }
      return ipAddress === range;
    });
  }

  // Rate limiting helpers

  private canMakeAbuseIPDBRequest(): boolean {
    this.resetAbuseIPDBCounterIfNeeded();
    return this.abuseIPDBRequests < this.config.abuseIPDB.rateLimit;
  }

  private canMakeVirusTotalRequest(): boolean {
    this.resetVirusTotalCounterIfNeeded();
    return this.virusTotalRequests < this.config.virusTotal.rateLimit;
  }

  private resetAbuseIPDBCounterIfNeeded(): void {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.lastAbuseIPDBReset > dayInMs) {
      this.abuseIPDBRequests = 0;
      this.lastAbuseIPDBReset = now;
    }
  }

  private resetVirusTotalCounterIfNeeded(): void {
    const now = Date.now();
    const minuteInMs = 60 * 1000;
    
    if (now - this.lastVirusTotalReset > minuteInMs) {
      this.virusTotalRequests = 0;
      this.lastVirusTotalReset = now;
    }
  }

  // Utility methods

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private mapAbuseIPDBCategories(data: AbuseIPDBResponse): string[] {
    const categories = [];
    
    if (data.abuseConfidencePercentage > 75) categories.push('high_confidence_malicious');
    if (data.abuseConfidencePercentage > 25) categories.push('suspicious');
    if (data.totalReports > 10) categories.push('frequently_reported');
    if (data.usageType === 'hosting') categories.push('hosting_provider');
    if (data.usageType === 'isp') categories.push('isp');
    
    return categories;
  }

  private setupRequestInterceptors(): void {
    // AbuseIPDB request interceptor
    this.abuseIPDBClient.interceptors.request.use(
      (config) => {
        if (this.DEBUG) {
          console.log(`Making AbuseIPDB request: ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // AbuseIPDB response interceptor
    this.abuseIPDBClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          console.warn('AbuseIPDB rate limit exceeded');
        } else if (error.response?.status === 401) {
          console.error('AbuseIPDB API key invalid or expired');
        }
        return Promise.reject(error);
      }
    );

    // VirusTotal request interceptor
    this.virusTotalClient.interceptors.request.use(
      (config) => {
        if (this.DEBUG) {
          console.log(`Making VirusTotal request: ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // VirusTotal response interceptor
    this.virusTotalClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          console.warn('VirusTotal rate limit exceeded');
        } else if (error.response?.status === 401) {
          console.error('VirusTotal API key invalid or expired');
        }
        return Promise.reject(error);
      }
    );
  }
}

/**
 * Create threat intelligence service instance
 */
export function createThreatIntelligenceService(cacheService: any): ThreatIntelligenceService {
  const config: ThreatIntelligenceConfig = {
    abuseIPDB: {
      apiKey: process.env.ABUSEIPDB_API_KEY || '',
      baseUrl: 'https://api.abuseipdb.com/api/v2',
      rateLimit: 1000, // requests per day for free tier
      confidenceThreshold: 75 // 75% confidence threshold
    },
    virusTotal: {
      apiKey: process.env.VIRUSTOTAL_API_KEY || '',
      baseUrl: 'https://www.virustotal.com/api/v3',
      rateLimit: 4, // requests per minute for free tier
      maliciousThreshold: 3 // minimum 3 engines detecting as malicious
    },
    cache: {
      ttl: 3600, // 1 hour cache
      namespace: 'threat_intel'
    },
    scoring: {
      abuseIPDBWeight: 0.6,  // AbuseIPDB gets 60% weight
      virusTotalWeight: 0.4, // VirusTotal gets 40% weight
      minimumConfidence: 60  // 60% minimum confidence for malicious classification
    }
  };

  return new ThreatIntelligenceService(config, cacheService);
}

// Export singleton for use in routes
let threatIntelligenceService: ThreatIntelligenceService | null = null;

export function getThreatIntelligenceService(cacheService: any): ThreatIntelligenceService {
  if (!threatIntelligenceService) {
    threatIntelligenceService = createThreatIntelligenceService(cacheService);
  }
  return threatIntelligenceService;
}

export default ThreatIntelligenceService;