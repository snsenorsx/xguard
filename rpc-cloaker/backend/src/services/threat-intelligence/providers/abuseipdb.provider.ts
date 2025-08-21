/**
 * AbuseIPDB Provider
 * Handles communication with AbuseIPDB API
 */

import axios, { AxiosInstance } from 'axios';
import { 
  ThreatProviderResult, 
  AbuseIPDBResponse,
  ThreatSource 
} from '../types';
import { 
  ABUSEIPDB_CATEGORIES, 
  HIGH_RISK_CATEGORIES, 
  MEDIUM_RISK_CATEGORIES 
} from '../constants';

export class AbuseIPDBProvider {
  private client: AxiosInstance;
  private apiKey: string;
  private rateLimit: number;
  private requests = 0;
  private lastReset = Date.now();
  private enabled: boolean;

  constructor(config: {
    apiKey: string;
    baseUrl: string;
    rateLimit: number;
    enabled?: boolean;
  }) {
    this.apiKey = config.apiKey;
    this.rateLimit = config.rateLimit;
    this.enabled = config.enabled ?? true;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 10000,
      headers: {
        'Key': config.apiKey,
        'Accept': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('AbuseIPDB API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  async checkIP(ipAddress: string, maxAgeInDays = 90): Promise<ThreatProviderResult> {
    if (!this.enabled) {
      return {
        provider: 'AbuseIPDB',
        success: false,
        error: 'Provider disabled',
        cached: false
      };
    }

    if (!this.canMakeRequest()) {
      return {
        provider: 'AbuseIPDB',
        success: false,
        error: 'Rate limit exceeded',
        cached: false
      };
    }

    try {
      this.requests++;
      
      const response = await this.client.get<AbuseIPDBResponse>('/check', {
        params: {
          ipAddress,
          maxAgeInDays,
          verbose: true
        }
      });

      return {
        provider: 'AbuseIPDB',
        success: true,
        data: response.data,
        cached: false
      };

    } catch (error: any) {
      return {
        provider: 'AbuseIPDB',
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message,
        cached: false
      };
    }
  }

  processResult(result: AbuseIPDBResponse): ThreatSource {
    const data = result.data;
    const categories = this.extractCategories(data.reports || []);
    const riskLevel = this.calculateRiskLevel(categories, data.abuseConfidenceScore);

    return {
      name: 'AbuseIPDB',
      score: data.abuseConfidenceScore,
      categories: categories.map(id => ABUSEIPDB_CATEGORIES[id] || `Unknown (${id})`),
      reliable: true,
      timestamp: new Date(),
      details: {
        ipAddress: data.ipAddress,
        isWhitelisted: data.isWhitelisted,
        countryCode: data.countryCode,
        usageType: data.usageType,
        isp: data.isp,
        domain: data.domain,
        totalReports: data.totalReports,
        numDistinctUsers: data.numDistinctUsers,
        lastReportedAt: data.lastReportedAt,
        riskLevel
      }
    };
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Reset counter if a day has passed
    if (now - this.lastReset > dayInMs) {
      this.requests = 0;
      this.lastReset = now;
    }

    return this.requests < this.rateLimit;
  }

  private extractCategories(reports: any[]): number[] {
    const categorySet = new Set<number>();
    
    reports.forEach(report => {
      if (report.categories && Array.isArray(report.categories)) {
        report.categories.forEach((cat: number) => categorySet.add(cat));
      }
    });

    return Array.from(categorySet);
  }

  private calculateRiskLevel(categories: number[], confidenceScore: number): string {
    // Check for high-risk categories
    const hasHighRisk = categories.some(cat => HIGH_RISK_CATEGORIES.includes(cat));
    const hasMediumRisk = categories.some(cat => MEDIUM_RISK_CATEGORIES.includes(cat));

    if (confidenceScore >= 75 || hasHighRisk) {
      return 'high';
    } else if (confidenceScore >= 50 || hasMediumRisk) {
      return 'medium';
    } else if (confidenceScore >= 25) {
      return 'low';
    }
    
    return 'minimal';
  }

  getProviderInfo() {
    return {
      name: 'AbuseIPDB',
      enabled: this.enabled,
      rateLimit: this.rateLimit,
      requestsToday: this.requests,
      categories: ABUSEIPDB_CATEGORIES
    };
  }
}