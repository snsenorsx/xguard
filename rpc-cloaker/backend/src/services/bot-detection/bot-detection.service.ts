/**
 * Bot Detection Service
 * Orchestrates multiple analyzers and detectors for comprehensive bot detection
 */

import { 
  BotDetectionResult, 
  BotDetectionConfig, 
  RequestContext 
} from './types';

import { UserAgentAnalyzer } from './analyzers/user-agent.analyzer';
import { HeaderAnalyzer } from './analyzers/header.analyzer';
import { NetworkAnalyzer } from './analyzers/network.analyzer';
import { FingerprintAnalyzer } from './analyzers/fingerprint.analyzer';
import { BehaviorAnalyzer } from './analyzers/behavior.analyzer';
import { HeadlessDetector } from './detectors/headless.detector';

export class BotDetectionService {
  private config: BotDetectionConfig;
  private userAgentAnalyzer: UserAgentAnalyzer;
  private headerAnalyzer: HeaderAnalyzer;
  private networkAnalyzer: NetworkAnalyzer;
  private fingerprintAnalyzer: FingerprintAnalyzer;
  private behaviorAnalyzer: BehaviorAnalyzer;
  private headlessDetector: HeadlessDetector;
  
  private cache = new Map<string, BotDetectionResult>();

  constructor(config?: Partial<BotDetectionConfig>) {
    this.config = {
      enabled: true,
      thresholds: {
        bot: 0.7,
        suspicious: 0.5,
        ...config?.thresholds
      },
      weights: {
        userAgent: 0.2,
        headers: 0.15,
        network: 0.2,
        fingerprint: 0.2,
        headless: 0.15,
        behavior: 0.1,
        ...config?.weights
      },
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hour
        ...config?.cache
      },
      ...config
    };

    // Initialize analyzers
    this.userAgentAnalyzer = new UserAgentAnalyzer();
    this.headerAnalyzer = new HeaderAnalyzer();
    this.networkAnalyzer = new NetworkAnalyzer();
    this.fingerprintAnalyzer = new FingerprintAnalyzer();
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    this.headlessDetector = new HeadlessDetector();
  }

  async detect(context: RequestContext): Promise<BotDetectionResult> {
    if (!this.config.enabled) {
      return this.createDefaultResult(false, 'Bot detection disabled');
    }

    // Check cache if enabled
    const cacheKey = this.generateCacheKey(context);
    if (this.config.cache.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Run all analyzers in parallel for performance
      const [
        userAgentResult,
        headerResult,
        networkResult,
        fingerprintResult,
        behaviorResult,
        headlessResult
      ] = await Promise.all([
        this.userAgentAnalyzer.analyze(context),
        this.headerAnalyzer.analyze(context),
        this.networkAnalyzer.analyze(context),
        this.fingerprintAnalyzer.analyze(context),
        this.behaviorAnalyzer.analyze(context),
        this.headlessDetector.detect(context)
      ]);

      // Calculate weighted score
      const weightedScore = this.calculateWeightedScore({
        userAgent: userAgentResult.score,
        headers: headerResult.score,
        network: networkResult.score,
        fingerprint: fingerprintResult.score,
        headless: headlessResult.detected ? headlessResult.confidence : 0,
        behavior: behaviorResult.score
      });

      // Determine if bot
      const isBot = weightedScore >= this.config.thresholds.bot;
      const isSuspicious = weightedScore >= this.config.thresholds.suspicious;

      // Compile all flags
      const allFlags = [
        ...userAgentResult.flags.map(f => `ua:${f}`),
        ...headerResult.flags.map(f => `header:${f}`),
        ...networkResult.flags.map(f => `network:${f}`),
        ...fingerprintResult.flags.map(f => `fp:${f}`),
        ...behaviorResult.flags.map(f => `behavior:${f}`),
        ...headlessResult.indicators.map(f => `headless:${f}`)
      ];

      // Determine bot type and reason
      const { type, reason } = this.determineBotTypeAndReason(
        isBot,
        isSuspicious,
        {
          userAgentResult,
          headerResult,
          networkResult,
          fingerprintResult,
          behaviorResult,
          headlessResult
        }
      );

      const result: BotDetectionResult = {
        isBot,
        confidence: weightedScore,
        type,
        reason,
        details: {
          userAgentScore: userAgentResult.score,
          headerScore: headerResult.score,
          networkScore: networkResult.score,
          fingerprintScore: fingerprintResult.score,
          headlessScore: headlessResult.detected ? headlessResult.confidence : 0,
          behaviorScore: behaviorResult.score
        },
        flags: allFlags
      };

      // Cache result if enabled
      if (this.config.cache.enabled) {
        this.cacheResult(cacheKey, result);
      }

      return result;

    } catch (error) {
      console.error('Bot detection error:', error);
      return this.createDefaultResult(false, 'Bot detection error');
    }
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    return {
      status: 'healthy',
      details: {
        enabled: this.config.enabled,
        thresholds: this.config.thresholds,
        weights: this.config.weights,
        cacheSize: this.cache.size
      }
    };
  }

  private calculateWeightedScore(scores: Record<string, number>): number {
    const weights = this.config.weights;
    
    const weightedSum = 
      scores.userAgent * weights.userAgent +
      scores.headers * weights.headers +
      scores.network * weights.network +
      scores.fingerprint * weights.fingerprint +
      scores.headless * weights.headless +
      scores.behavior * weights.behavior;

    // Normalize to ensure score is between 0 and 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    return Math.min(weightedSum / totalWeight, 1.0);
  }

  private determineBotTypeAndReason(
    isBot: boolean,
    isSuspicious: boolean,
    results: any
  ): { type?: string; reason: string } {
    if (!isBot && !isSuspicious) {
      return { reason: 'Human visitor detected' };
    }

    // Check for headless browser
    if (results.headlessResult.detected) {
      return {
        type: results.headlessResult.type || 'headless',
        reason: `Headless browser detected: ${results.headlessResult.type || 'unknown'}`
      };
    }

    // Check for high user agent score
    if (results.userAgentResult.score > 0.8) {
      const botPattern = results.userAgentResult.flags.find((f: string) => f.includes('bot_pattern_'));
      if (botPattern) {
        const pattern = botPattern.replace('bot_pattern_', '');
        return {
          type: pattern,
          reason: `Bot user agent detected: ${pattern}`
        };
      }
    }

    // Check for network indicators
    if (results.networkResult.score > 0.8) {
      if (results.networkResult.flags.includes('datacenter_ip')) {
        return {
          type: 'datacenter_bot',
          reason: 'Request from datacenter IP'
        };
      }
      if (results.networkResult.flags.includes('tor_exit_node')) {
        return {
          type: 'tor_bot',
          reason: 'Request from Tor exit node'
        };
      }
    }

    // Check for fingerprint anomalies
    if (results.fingerprintResult.score > 0.8) {
      return {
        type: 'suspicious_fingerprint',
        reason: 'Abnormal browser fingerprint detected'
      };
    }

    // Generic bot/suspicious
    if (isBot) {
      return {
        type: 'unknown_bot',
        reason: 'Multiple bot indicators detected'
      };
    }

    return {
      type: 'suspicious',
      reason: 'Suspicious activity detected'
    };
  }

  private generateCacheKey(context: RequestContext): string {
    // Create a unique key based on IP, user agent, and fingerprint hash
    const fingerprintHash = context.fingerprint?.hash || 
                          context.fingerprint?.canvas?.hash || 
                          'no-fp';
    
    return `bot:${context.ipAddress}:${this.hashString(context.userAgent)}:${fingerprintHash}`;
  }

  private hashString(str: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  private cacheResult(key: string, result: BotDetectionResult): void {
    this.cache.set(key, result);
    
    // Set TTL for cache cleanup
    setTimeout(() => {
      this.cache.delete(key);
    }, this.config.cache.ttl);

    // Limit cache size
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  private createDefaultResult(isBot: boolean, reason: string): BotDetectionResult {
    return {
      isBot,
      confidence: 0,
      reason,
      details: {
        userAgentScore: 0,
        headerScore: 0,
        networkScore: 0,
        fingerprintScore: 0,
        headlessScore: 0,
        behaviorScore: 0
      },
      flags: []
    };
  }
}