/**
 * Bot Detection Constants
 */

export const BOT_USER_AGENTS = [
  // Crawlers & Spiders
  'bot', 'crawler', 'spider', 'scraper', 'crawl',
  
  // HTTP Libraries
  'curl', 'wget', 'python', 'java', 'ruby', 'perl', 'php', 
  'go-http', 'node-fetch', 'axios', 'request', 'urllib',
  
  // Automation Tools
  'headless', 'phantom', 'selenium', 'puppeteer', 'playwright',
  'webdriver', 'chromedriver', 'geckodriver',
  
  // Search Engine Bots
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 
  'yandexbot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  
  // Social Media & Messaging
  'whatsapp', 'telegram', 'discord', 'slack', 'skype',
  
  // Monitoring & Security
  'pingdom', 'uptimerobot', 'newrelic', 'appdynamics',
  'nagios', 'zabbix', 'datadog'
];

export const DATACENTER_ASNS = [
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
];

export const SUSPICIOUS_HEADERS = {
  // Proxy headers
  'x-forwarded-for': 1.5,
  'x-real-ip': 1.5,
  'x-originating-ip': 1.5,
  'x-forwarded-host': 1.5,
  'x-proxy-connection': 2.0,
  'via': 1.5,
  'forwarded': 1.5,
  
  // Automation headers
  'x-automation': 3.0,
  'x-bot': 3.0,
  'x-crawler': 3.0,
  
  // Development headers
  'x-debug': 1.0,
  'x-test': 1.0,
};

export const REQUIRED_HEADERS = [
  'accept',
  'accept-language',
  'accept-encoding',
  'user-agent'
];

export const HEADLESS_INDICATORS = {
  // User agent patterns
  userAgentPatterns: [
    'headless',
    'phantomjs',
    'slimerjs', 
    'htmlunit'
  ],
  
  // Window properties
  windowProperties: [
    'webdriver',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__webdriver_script_function',
    '__webdriver_script_func',
    '__webdriver_script_fn',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '_phantom',
    '__nightmare',
    '_selenium',
    'callPhantom',
    'callSelenium',
    '_Selenium_IDE_Recorder',
    '__stopAllTimers'
  ],
  
  // Navigator properties
  navigatorProperties: [
    'webdriver',
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped'
  ]
};

export const BROWSER_VERSIONS = {
  chrome: {
    min: 90,
    current: 120
  },
  firefox: {
    min: 88,
    current: 121
  },
  safari: {
    min: 14,
    current: 17
  },
  edge: {
    min: 90,
    current: 120
  }
};