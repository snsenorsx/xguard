/**
 * Threat Intelligence Constants
 */

export const ABUSEIPDB_CATEGORIES: { [key: number]: string } = {
  1: 'DNS Compromise',
  2: 'DNS Poisoning',
  3: 'Fraud Orders',
  4: 'DDoS Attack',
  5: 'FTP Brute-Force',
  6: 'Ping of Death',
  7: 'Phishing',
  8: 'Fraud VoIP',
  9: 'Open Proxy',
  10: 'Web Spam',
  11: 'Email Spam',
  12: 'Blog Spam',
  13: 'VPN IP',
  14: 'Port Scan',
  15: 'Hacking',
  16: 'SQL Injection',
  17: 'Spoofing',
  18: 'Brute-Force',
  19: 'Bad Web Bot',
  20: 'Exploited Host',
  21: 'Web App Attack',
  22: 'SSH',
  23: 'IoT Targeted'
};

export const HIGH_RISK_CATEGORIES = [
  4,  // DDoS Attack
  15, // Hacking
  16, // SQL Injection
  18, // Brute-Force
  19, // Bad Web Bot
  21, // Web App Attack
];

export const MEDIUM_RISK_CATEGORIES = [
  9,  // Open Proxy
  13, // VPN IP
  14, // Port Scan
  20, // Exploited Host
];

export const RESERVED_IP_RANGES = [
  // Private IPv4 ranges
  { start: '10.0.0.0', end: '10.255.255.255', label: 'Private Class A' },
  { start: '172.16.0.0', end: '172.31.255.255', label: 'Private Class B' },
  { start: '192.168.0.0', end: '192.168.255.255', label: 'Private Class C' },
  
  // Loopback
  { start: '127.0.0.0', end: '127.255.255.255', label: 'Loopback' },
  
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255', label: 'Link-local' },
  
  // Reserved
  { start: '0.0.0.0', end: '0.255.255.255', label: 'Reserved' },
  { start: '224.0.0.0', end: '239.255.255.255', label: 'Multicast' },
  { start: '240.0.0.0', end: '255.255.255.255', label: 'Reserved' }
];

export const DATACENTER_ASN_LIST = [
  '13335', // Cloudflare
  '15169', // Google
  '16509', // Amazon AWS
  '8075',  // Microsoft Azure
  '14061', // DigitalOcean
  '20473', // Vultr
  '63949', // Linode
  '24940', // Hetzner
  '16276', // OVH
  '12876', // Scaleway
  '51167', // Contabo
  '40676', // Psychz Networks
  '396982', // Google Cloud
  '54113', // Fastly
  '2635',  // Automattic
  '30633', // Leaseweb
  '45102', // Alibaba Cloud
];

export const DEFAULT_CONFIG = {
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    namespace: 'threat'
  },
  scoring: {
    minimumConfidence: 10,
    autoBlacklistThreshold: 75
  },
  fallbackBehavior: 'allow' as const
};