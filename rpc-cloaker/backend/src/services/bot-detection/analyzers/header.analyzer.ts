/**
 * Header Analyzer
 * Analyzes HTTP headers for suspicious patterns and missing required headers
 */

import { AnalyzerResult, RequestContext } from '../types';
import { SUSPICIOUS_HEADERS, REQUIRED_HEADERS } from '../constants';

export class HeaderAnalyzer {
  analyze(context: RequestContext): AnalyzerResult {
    const headers = this.normalizeHeaders(context.headers);
    const flags: string[] = [];
    let suspiciousScore = 0;
    let maxScore = 0;

    // Check for suspicious headers
    for (const [header, weight] of Object.entries(SUSPICIOUS_HEADERS)) {
      maxScore += weight;
      if (headers[header]) {
        suspiciousScore += weight;
        flags.push(`suspicious_header_${header}`);
      }
    }

    // Check for missing required headers
    let missingRequiredCount = 0;
    for (const header of REQUIRED_HEADERS) {
      if (!headers[header]) {
        missingRequiredCount++;
        flags.push(`missing_required_${header}`);
      }
    }

    // Check for automation/bot specific headers
    const botHeaders = this.checkBotHeaders(headers);
    if (botHeaders.length > 0) {
      flags.push(...botHeaders);
      suspiciousScore += botHeaders.length * 2;
    }

    // Check header anomalies
    const anomalies = this.checkHeaderAnomalies(headers);
    if (anomalies.length > 0) {
      flags.push(...anomalies);
      suspiciousScore += anomalies.length * 1.5;
    }

    // Calculate final score
    const normalizedSuspiciousScore = Math.min(suspiciousScore / (maxScore + 2), 1.0);
    const missingHeaderScore = missingRequiredCount / REQUIRED_HEADERS.length;
    const score = Math.min((normalizedSuspiciousScore * 0.7) + (missingHeaderScore * 0.3), 1.0);

    return {
      score,
      confidence: this.calculateConfidence(flags, headers),
      flags,
      details: {
        suspiciousHeaders: flags.filter(f => f.startsWith('suspicious_header_')),
        missingHeaders: flags.filter(f => f.startsWith('missing_required_')),
        headerCount: Object.keys(headers).length
      }
    };
  }

  private normalizeHeaders(headers: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  private checkBotHeaders(headers: Record<string, string>): string[] {
    const flags: string[] = [];
    
    // Check for bot-specific headers
    const botHeaderPatterns = [
      'x-bot',
      'x-crawler',
      'x-robot',
      'x-spider',
      'x-scraper',
      'bot-id',
      'crawler-id'
    ];

    for (const pattern of botHeaderPatterns) {
      if (headers[pattern]) {
        flags.push(`bot_header_${pattern}`);
      }
    }

    // Check for automation headers
    if (headers['x-automation'] || headers['x-automated']) {
      flags.push('automation_header_present');
    }

    return flags;
  }

  private checkHeaderAnomalies(headers: Record<string, string>): string[] {
    const flags: string[] = [];

    // Check Accept header
    const accept = headers['accept'];
    if (accept) {
      if (accept === '*/*') {
        flags.push('generic_accept_header');
      } else if (!accept.includes('text/html') && !accept.includes('application/json')) {
        flags.push('unusual_accept_header');
      }
    }

    // Check Accept-Language
    const acceptLang = headers['accept-language'];
    if (acceptLang) {
      if (acceptLang === '*' || acceptLang.length < 2) {
        flags.push('invalid_accept_language');
      }
    }

    // Check Accept-Encoding
    const acceptEncoding = headers['accept-encoding'];
    if (acceptEncoding && !acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
      flags.push('unusual_accept_encoding');
    }

    // Check for inconsistent headers
    if (headers['user-agent'] && headers['x-requested-with']) {
      const ua = headers['user-agent'].toLowerCase();
      const requestedWith = headers['x-requested-with'].toLowerCase();
      
      if (ua.includes('chrome') && requestedWith.includes('firefox')) {
        flags.push('inconsistent_browser_headers');
      }
    }

    // Check for too many proxy headers
    const proxyHeaderCount = Object.keys(headers).filter(h => 
      h.includes('proxy') || h.includes('forwarded')
    ).length;
    
    if (proxyHeaderCount > 3) {
      flags.push('excessive_proxy_headers');
    }

    return flags;
  }

  private calculateConfidence(flags: string[], headers: Record<string, string>): number {
    // Higher confidence with more specific indicators
    if (flags.some(f => f.includes('bot_header_') || f.includes('automation_header'))) {
      return 0.95;
    }
    
    if (flags.filter(f => f.startsWith('missing_required_')).length >= 3) {
      return 0.9;
    }
    
    if (flags.includes('excessive_proxy_headers')) {
      return 0.85;
    }
    
    if (flags.length > 5) {
      return 0.8;
    }
    
    if (flags.length > 3) {
      return 0.7;
    }
    
    return 0.5 + (flags.length * 0.05);
  }
}