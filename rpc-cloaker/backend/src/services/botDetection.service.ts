import { VisitorInfo } from './cloaker.service';
import { CacheService } from './redis.service';
import { config } from '../config';
import axios from 'axios';

export interface BotDetectionResult {
  isBot: boolean;
  score: number;
  reason: string;
  details: {
    userAgentScore: number;
    behaviorScore: number;
    networkScore: number;
    fingerprintScore: number;
  };
}

export class BotDetectionService {
  private static readonly BOT_USER_AGENTS = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python', 'java', 'ruby', 'perl', 'php', 'go-http',
    'headless', 'phantom', 'selenium', 'puppeteer',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'facebookexternalhit',
    'twitterbot', 'linkedinbot', 'whatsapp', 'telegram',
    'discord', 'slack',
  ];

  private static readonly DATACENTER_ASNS = [
    '13335', // Cloudflare
    '15169', // Google
    '16509', // Amazon AWS
    '8075',  // Microsoft Azure
    '14061', // DigitalOcean
    '20473', // Vultr
    '63949', // Linode
    '24940', // Hetzner
  ];

  private static readonly SUSPICIOUS_HEADERS = {
    'x-forwarded-for': 1.5,
    'x-real-ip': 1.5,
    'x-originating-ip': 1.5,
    'x-forwarded-host': 1.5,
    'x-proxy-connection': 2.0,
    'via': 1.5,
    'forwarded': 1.5,
  };

  async detect(visitorInfo: VisitorInfo): Promise<BotDetectionResult> {
    if (!config.botDetection.enabled) {
      return {
        isBot: false,
        score: 0,
        reason: 'Bot detection disabled',
        details: {
          userAgentScore: 0,
          behaviorScore: 0,
          networkScore: 0,
          fingerprintScore: 0,
        },
      };
    }

    // Check cache first
    const cacheKey = `bot:${visitorInfo.fingerprintHash}`;
    const cached = await CacheService.get<BotDetectionResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Run detection layers in parallel
    const [
      userAgentScore,
      headerScore,
      networkScore,
      fingerprintScore,
    ] = await Promise.all([
      this.checkUserAgent(visitorInfo),
      this.checkHeaders(visitorInfo),
      this.checkNetwork(visitorInfo),
      this.checkFingerprint(visitorInfo),
    ]);

    // Calculate combined score
    const totalScore = (
      userAgentScore * 0.3 +
      headerScore * 0.2 +
      networkScore * 0.3 +
      fingerprintScore * 0.2
    );

    const isBot = totalScore >= config.botDetection.threshold;
    
    let reason = 'Human visitor';
    if (isBot) {
      const scores = [
        { name: 'User-Agent', score: userAgentScore },
        { name: 'Headers', score: headerScore },
        { name: 'Network', score: networkScore },
        { name: 'Fingerprint', score: fingerprintScore },
      ];
      const highest = scores.reduce((a, b) => a.score > b.score ? a : b);
      reason = `${highest.name} anomaly detected`;
    }

    const result: BotDetectionResult = {
      isBot,
      score: totalScore,
      reason,
      details: {
        userAgentScore,
        behaviorScore: 0, // Will be updated from ML service
        networkScore,
        fingerprintScore,
      },
    };

    // Cache result
    await CacheService.set(cacheKey, result, 300); // 5 minutes

    // Send to ML service for analysis (async)
    this.sendToMLService(visitorInfo, result).catch(() => {
      // Ignore ML service errors
    });

    return result;
  }

  private async checkUserAgent(visitorInfo: VisitorInfo): Promise<number> {
    const ua = visitorInfo.userAgent.toLowerCase();
    
    // Empty or missing user agent
    if (!ua || ua.length < 10) {
      return 1.0;
    }

    // Check against known bot patterns
    for (const pattern of BotDetectionService.BOT_USER_AGENTS) {
      if (ua.includes(pattern)) {
        return 1.0;
      }
    }

    // Check for missing browser info
    if (!visitorInfo.browser?.name) {
      return 0.8;
    }

    // Check for outdated browsers
    const browserVersion = parseInt(visitorInfo.browser.version);
    if (visitorInfo.browser.name === 'Chrome' && browserVersion < 90) {
      return 0.6;
    }

    // Check for inconsistencies
    if (ua.includes('windows') && visitorInfo.os?.name === 'Mac OS') {
      return 0.9;
    }

    return 0.0;
  }

  private async checkHeaders(visitorInfo: VisitorInfo): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Check for suspicious headers
    for (const [header, weight] of Object.entries(BotDetectionService.SUSPICIOUS_HEADERS)) {
      maxScore += weight;
      if (visitorInfo.headers[header]) {
        score += weight;
      }
    }

    // Check for missing common headers
    const expectedHeaders = ['accept', 'accept-language', 'accept-encoding'];
    for (const header of expectedHeaders) {
      if (!visitorInfo.headers[header]) {
        score += 0.5;
      }
    }

    // Normalize score
    return Math.min(score / (maxScore + 1.5), 1.0);
  }

  private async checkNetwork(visitorInfo: VisitorInfo): Promise<number> {
    // Check if IP is from datacenter
    const cacheKey = `network:${visitorInfo.ip}`;
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    let score = 0;

    // Check against known datacenter IPs
    // In production, you would use a proper IP reputation service
    if (this.isDatacenterIP(visitorInfo.ip)) {
      score = 0.8;
    }

    // Check geolocation consistency
    if (!visitorInfo.geo) {
      score = Math.max(score, 0.6);
    }

    await CacheService.set(cacheKey, score, 3600); // Cache for 1 hour
    return score;
  }

  private async checkFingerprint(visitorInfo: VisitorInfo): Promise<number> {
    // Basic fingerprint analysis
    let score = 0;

    // Check accept-language header
    const acceptLang = visitorInfo.headers['accept-language'];
    if (!acceptLang || acceptLang === '*') {
      score += 0.3;
    }

    // Check DNT header (Do Not Track)
    if (visitorInfo.headers['dnt'] === '1') {
      score += 0.1; // Slightly suspicious as most bots don't set this
    }

    // Check for WebDriver
    // This would normally be checked client-side
    
    return Math.min(score, 1.0);
  }

  private isDatacenterIP(ip: string): boolean {
    // This is a simplified check
    // In production, use MaxMind or IP2Location database
    const ipParts = ip.split('.');
    
    // Check common cloud provider ranges
    if (ipParts[0] === '34' || ipParts[0] === '35') { // Google Cloud
      return true;
    }
    if (ipParts[0] === '52' || ipParts[0] === '54') { // AWS
      return true;
    }
    
    return false;
  }

  private async sendToMLService(
    visitorInfo: VisitorInfo,
    detectionResult: BotDetectionResult
  ): Promise<void> {
    try {
      await axios.post(
        `${config.mlService.url}/analyze`,
        {
          visitor: visitorInfo,
          detection: detectionResult,
        },
        {
          headers: {
            'X-API-Key': config.mlService.apiKey,
          },
          timeout: 1000, // 1 second timeout
        }
      );
    } catch (error) {
      // Ignore errors - ML service is non-critical
    }
  }
}