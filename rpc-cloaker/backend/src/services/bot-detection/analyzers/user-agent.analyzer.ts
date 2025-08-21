/**
 * User Agent Analyzer
 * Analyzes user agent strings for bot patterns and anomalies
 */

import { AnalyzerResult, RequestContext } from '../types';
import { BOT_USER_AGENTS, BROWSER_VERSIONS } from '../constants';

export class UserAgentAnalyzer {
  analyze(context: RequestContext): AnalyzerResult {
    const userAgent = context.userAgent.toLowerCase();
    const flags: string[] = [];
    let score = 0;

    // Check if user agent is empty or too short
    if (!userAgent || userAgent.length < 10) {
      flags.push('empty_or_short_user_agent');
      return {
        score: 1.0,
        confidence: 1.0,
        flags,
        details: { reason: 'Empty or invalid user agent' }
      };
    }

    // Check against known bot patterns
    for (const pattern of BOT_USER_AGENTS) {
      if (userAgent.includes(pattern)) {
        flags.push(`bot_pattern_${pattern}`);
        score = Math.max(score, 0.9);
      }
    }

    // Check for missing browser information
    const browserInfo = this.extractBrowserInfo(userAgent);
    if (!browserInfo.name) {
      flags.push('missing_browser_info');
      score = Math.max(score, 0.7);
    }

    // Check for outdated browsers
    if (browserInfo.name && browserInfo.version) {
      const minVersion = BROWSER_VERSIONS[browserInfo.name as keyof typeof BROWSER_VERSIONS]?.min;
      if (minVersion && browserInfo.version < minVersion) {
        flags.push(`outdated_${browserInfo.name}_v${browserInfo.version}`);
        score = Math.max(score, 0.6);
      }
    }

    // Check for user agent spoofing indicators
    if (this.detectSpoofing(userAgent)) {
      flags.push('user_agent_spoofing');
      score = Math.max(score, 0.8);
    }

    // Check for automation tool indicators
    if (this.detectAutomationTools(userAgent)) {
      flags.push('automation_tool_detected');
      score = Math.max(score, 0.95);
    }

    return {
      score,
      confidence: this.calculateConfidence(flags),
      flags,
      details: {
        userAgent,
        browserInfo,
        isMobile: this.isMobile(userAgent),
        isTablet: this.isTablet(userAgent)
      }
    };
  }

  private extractBrowserInfo(userAgent: string): { name?: string; version?: number } {
    const browsers = {
      chrome: /chrome\/(\d+)/i,
      firefox: /firefox\/(\d+)/i,
      safari: /safari\/(\d+)/i,
      edge: /edg\/(\d+)/i,
      opera: /opera\/(\d+)/i
    };

    for (const [name, regex] of Object.entries(browsers)) {
      const match = userAgent.match(regex);
      if (match) {
        return {
          name,
          version: parseInt(match[1])
        };
      }
    }

    return {};
  }

  private detectSpoofing(userAgent: string): boolean {
    // Check for inconsistencies
    const checks = [
      // Chrome UA but no Chrome string
      userAgent.includes('applewebkit') && 
      !userAgent.includes('chrome') && 
      !userAgent.includes('safari'),
      
      // Multiple browser identifiers
      (userAgent.includes('chrome') && userAgent.includes('firefox')),
      
      // Invalid version formats
      /chrome\/\d{4}/.test(userAgent), // Chrome version > 999
      
      // Missing required components
      userAgent.includes('mozilla') && !userAgent.includes('gecko') && !userAgent.includes('applewebkit')
    ];

    return checks.some(check => check);
  }

  private detectAutomationTools(userAgent: string): boolean {
    const automationPatterns = [
      /phantomjs/i,
      /headless/i,
      /electron/i,
      /slimerjs/i,
      /webdriver/i,
      /selenium/i,
      /puppeteer/i,
      /playwright/i
    ];

    return automationPatterns.some(pattern => pattern.test(userAgent));
  }

  private isMobile(userAgent: string): boolean {
    return /mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent);
  }

  private isTablet(userAgent: string): boolean {
    return /tablet|ipad|playbook|silk/i.test(userAgent);
  }

  private calculateConfidence(flags: string[]): number {
    // Higher confidence with more specific indicators
    if (flags.some(f => f.includes('bot_pattern_') || f.includes('automation_tool'))) {
      return 0.95;
    }
    if (flags.includes('user_agent_spoofing')) {
      return 0.85;
    }
    if (flags.includes('outdated_')) {
      return 0.7;
    }
    if (flags.includes('missing_browser_info')) {
      return 0.6;
    }
    return 0.5;
  }
}