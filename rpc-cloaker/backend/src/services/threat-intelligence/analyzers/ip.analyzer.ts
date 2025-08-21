/**
 * IP Analyzer
 * Analyzes IP addresses for validity, type, and characteristics
 */

import { IPAnalysisResult } from '../types';
import { RESERVED_IP_RANGES, DATACENTER_ASN_LIST } from '../constants';

export class IPAnalyzer {
  /**
   * Analyze an IP address
   */
  analyze(ipAddress: string): IPAnalysisResult {
    const isValid = this.isValidIP(ipAddress);
    
    if (!isValid) {
      return {
        ipAddress,
        isValid: false,
        isPrivate: false,
        isReserved: false,
        version: 4
      };
    }

    const version = this.getIPVersion(ipAddress);
    const isPrivate = this.isPrivateIP(ipAddress);
    const isReserved = this.isReservedIP(ipAddress);

    return {
      ipAddress,
      isValid,
      isPrivate,
      isReserved,
      version,
      datacenter: this.isDatacenterIP(ipAddress)
    };
  }

  /**
   * Validate IP address format
   */
  isValidIP(ip: string): boolean {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  /**
   * Check if IP is IPv4
   */
  private isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Check if IP is IPv6
   */
  private isValidIPv6(ip: string): boolean {
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(ip);
  }

  /**
   * Get IP version
   */
  private getIPVersion(ip: string): 4 | 6 {
    return this.isValidIPv4(ip) ? 4 : 6;
  }

  /**
   * Check if IP is private
   */
  private isPrivateIP(ip: string): boolean {
    if (!this.isValidIPv4(ip)) return false;

    const parts = ip.split('.').map(Number);
    
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

  /**
   * Check if IP is reserved
   */
  private isReservedIP(ip: string): boolean {
    if (!this.isValidIPv4(ip)) return false;

    const ipNum = this.ipToNumber(ip);
    
    for (const range of RESERVED_IP_RANGES) {
      const startNum = this.ipToNumber(range.start);
      const endNum = this.ipToNumber(range.end);
      
      if (ipNum >= startNum && ipNum <= endNum) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if IP belongs to known datacenter
   */
  private isDatacenterIP(ip: string): boolean {
    // In production, this would check against:
    // 1. MaxMind GeoIP2 ISP database
    // 2. IP2Location database
    // 3. Known datacenter IP ranges
    
    // For now, simple pattern matching
    if (!this.isValidIPv4(ip)) return false;

    const parts = ip.split('.').map(Number);
    
    // Common datacenter patterns
    const datacenterPatterns = [
      // AWS
      { start: [3, 0], end: [3, 255] },
      { start: [18, 0], end: [18, 255] },
      { start: [52, 0], end: [52, 255] },
      { start: [54, 0], end: [54, 255] },
      
      // Google Cloud
      { start: [35, 0], end: [35, 255] },
      { start: [104, 196], end: [104, 199] },
      { start: [34, 0], end: [34, 255] },
      
      // Cloudflare
      { start: [104, 16], end: [104, 31] },
      { start: [172, 64], end: [172, 71] },
      { start: [173, 245], end: [173, 245] },
      
      // DigitalOcean
      { start: [104, 131], end: [104, 131] },
      { start: [159, 65], end: [159, 65] },
      { start: [167, 99], end: [167, 99] }
    ];

    for (const pattern of datacenterPatterns) {
      if (parts[0] === pattern.start[0]) {
        if (pattern.start.length === 1) {
          return true;
        }
        if (pattern.start.length === 2 && 
            parts[1] >= pattern.start[1] && 
            parts[1] <= pattern.end[1]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Convert IP to number for range comparison
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Check if IP is IPv4-mapped IPv6
   */
  isIPv4MappedIPv6(ip: string): boolean {
    return /^::ffff:(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  }

  /**
   * Extract IPv4 from IPv4-mapped IPv6
   */
  extractIPv4FromMapped(ip: string): string | null {
    const match = ip.match(/^::ffff:(.+)$/);
    return match ? match[1] : null;
  }
}