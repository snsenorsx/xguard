/**
 * Network Analyzer
 * Analyzes network characteristics including IP reputation and ASN
 */

import { AnalyzerResult, RequestContext } from '../types';
import { DATACENTER_ASNS } from '../constants';

export class NetworkAnalyzer {
  private ipCache = new Map<string, AnalyzerResult>();

  async analyze(context: RequestContext): Promise<AnalyzerResult> {
    const { ipAddress } = context;
    
    // Check cache first
    if (this.ipCache.has(ipAddress)) {
      return this.ipCache.get(ipAddress)!;
    }

    const flags: string[] = [];
    let score = 0;

    // Check if IP is valid
    if (!this.isValidIP(ipAddress)) {
      flags.push('invalid_ip_address');
      score = 0.8;
    }

    // Check if it's a local/private IP
    if (this.isPrivateIP(ipAddress)) {
      flags.push('private_ip_address');
      score = Math.max(score, 0.9);
    }

    // Check for known datacenter IPs
    if (await this.isDatacenterIP(ipAddress)) {
      flags.push('datacenter_ip');
      score = Math.max(score, 0.7);
    }

    // Check for proxy/VPN indicators
    const proxyCheck = this.checkProxyIndicators(context);
    if (proxyCheck.isProxy) {
      flags.push(...proxyCheck.flags);
      score = Math.max(score, 0.8);
    }

    // Check for TOR exit nodes
    if (this.isTorExitNode(ipAddress)) {
      flags.push('tor_exit_node');
      score = Math.max(score, 0.9);
    }

    const result: AnalyzerResult = {
      score,
      confidence: this.calculateConfidence(flags),
      flags,
      details: {
        ipAddress,
        isDatacenter: flags.includes('datacenter_ip'),
        isProxy: proxyCheck.isProxy,
        isTor: flags.includes('tor_exit_node')
      }
    };

    // Cache the result for 1 hour
    this.ipCache.set(ipAddress, result);
    setTimeout(() => this.ipCache.delete(ipAddress), 3600000);

    return result;
  }

  private isValidIP(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 validation (simplified)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // Check for private IP ranges
    return (
      // 10.0.0.0 - 10.255.255.255
      parts[0] === 10 ||
      // 172.16.0.0 - 172.31.255.255
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      // 192.168.0.0 - 192.168.255.255
      (parts[0] === 192 && parts[1] === 168) ||
      // 127.0.0.0 - 127.255.255.255 (loopback)
      parts[0] === 127
    );
  }

  private async isDatacenterIP(ip: string): Promise<boolean> {
    // In a production environment, you would:
    // 1. Use MaxMind GeoIP2 ISP database
    // 2. Query IP2Location or IPinfo.io
    // 3. Check against known datacenter IP ranges
    
    // For now, we'll do a simple check based on IP patterns
    const ipParts = ip.split('.').map(Number);
    
    // Common datacenter IP patterns
    const datacenterPatterns = [
      // AWS ranges (simplified)
      { start: [3, 0], end: [3, 255] },
      { start: [18, 0], end: [18, 255] },
      { start: [52, 0], end: [52, 255] },
      // Google Cloud ranges (simplified)
      { start: [35, 0], end: [35, 255] },
      { start: [104, 196], end: [104, 199] },
      // Cloudflare ranges (simplified)
      { start: [104, 16], end: [104, 31] },
      { start: [172, 64], end: [172, 71] }
    ];

    for (const pattern of datacenterPatterns) {
      if (ipParts[0] === pattern.start[0] && 
          (pattern.start.length === 1 || ipParts[1] >= pattern.start[1]) &&
          (pattern.end.length === 1 || ipParts[1] <= pattern.end[1])) {
        return true;
      }
    }

    return false;
  }

  private checkProxyIndicators(context: RequestContext): { isProxy: boolean; flags: string[] } {
    const flags: string[] = [];
    const headers = context.headers;

    // Check for multiple forwarded IPs
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor && forwardedFor.split(',').length > 2) {
      flags.push('multiple_forwarded_ips');
    }

    // Check for proxy-specific headers
    const proxyHeaders = [
      'x-proxy-id',
      'x-forwarded-server',
      'x-forwarded-host',
      'x-proxy-connection',
      'proxy-connection',
      'via'
    ];

    let proxyHeaderCount = 0;
    for (const header of proxyHeaders) {
      if (headers[header.toLowerCase()]) {
        proxyHeaderCount++;
      }
    }

    if (proxyHeaderCount >= 2) {
      flags.push('multiple_proxy_headers');
    }

    // Check for anonymizer services
    if (headers['x-anonymizer-ip'] || headers['x-anonymized']) {
      flags.push('anonymizer_detected');
    }

    return {
      isProxy: flags.length > 0,
      flags
    };
  }

  private isTorExitNode(ip: string): boolean {
    // In production, you would check against the Tor exit node list
    // https://check.torproject.org/exit-addresses
    // For now, return false
    return false;
  }

  private calculateConfidence(flags: string[]): number {
    if (flags.includes('tor_exit_node') || flags.includes('private_ip_address')) {
      return 0.95;
    }
    if (flags.includes('datacenter_ip') && flags.includes('multiple_proxy_headers')) {
      return 0.9;
    }
    if (flags.includes('datacenter_ip') || flags.includes('anonymizer_detected')) {
      return 0.8;
    }
    if (flags.length >= 2) {
      return 0.7;
    }
    if (flags.length === 1) {
      return 0.6;
    }
    return 0.5;
  }
}