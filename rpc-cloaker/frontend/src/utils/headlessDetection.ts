/**
 * Advanced Headless Browser Detection
 * Detects Puppeteer, Selenium, PhantomJS, and other automation tools
 */

export interface HeadlessDetectionResult {
  isHeadless: boolean;
  confidence: number;
  detections: string[];
  features: HeadlessFeatures;
  score: number;
}

export interface HeadlessFeatures {
  // Automation framework detection
  webdriver: boolean;
  selenium: boolean;
  puppeteer: boolean;
  phantomjs: boolean;
  playwright: boolean;
  
  // Browser properties anomalies
  missingPlugins: boolean;
  suspiciousUserAgent: boolean;
  webglVendorRenderer: boolean;
  languagesAnomaly: boolean;
  timezoneAnomaly: boolean;
  
  // Runtime environment checks
  chromeRuntime: boolean;
  debuggerOpen: boolean;
  automationControlled: boolean;
  phantomjsGlobal: boolean;
  
  // Performance and behavior
  tooFastExecution: boolean;
  mouseMovementPattern: boolean;
  keyboardPattern: boolean;
  scrollPattern: boolean;
}

/**
 * Comprehensive headless browser detection
 */
export async function detectHeadlessBrowser(): Promise<HeadlessDetectionResult> {
  const features: HeadlessFeatures = {
    webdriver: false,
    selenium: false,
    puppeteer: false,
    phantomjs: false,
    playwright: false,
    missingPlugins: false,
    suspiciousUserAgent: false,
    webglVendorRenderer: false,
    languagesAnomaly: false,
    timezoneAnomaly: false,
    chromeRuntime: false,
    debuggerOpen: false,
    automationControlled: false,
    phantomjsGlobal: false,
    tooFastExecution: false,
    mouseMovementPattern: false,
    keyboardPattern: false,
    scrollPattern: false
  };

  const detections: string[] = [];
  let score = 0;

  // 1. Direct automation framework detection
  await detectAutomationFrameworks(features, detections);
  
  // 2. Browser property anomalies
  detectBrowserAnomalies(features, detections);
  
  // 3. Runtime environment checks
  detectRuntimeEnvironment(features, detections);
  
  // 4. Performance and behavior analysis
  await detectPerformanceAnomalies(features, detections);

  // Calculate final score
  score = calculateHeadlessScore(features);
  
  const confidence = Math.min(score / 100, 1);
  const isHeadless = score >= 60; // Threshold for headless detection

  return {
    isHeadless,
    confidence,
    detections,
    features,
    score
  };
}

/**
 * Detect automation frameworks
 */
async function detectAutomationFrameworks(
  features: HeadlessFeatures,
  detections: string[]
): Promise<void> {
  // Webdriver detection
  if ('webdriver' in navigator || (navigator as any).webdriver === true) {
    features.webdriver = true;
    detections.push('WebDriver flag detected');
  }

  // Selenium detection
  if (
    'selenium' in window ||
    '_Selenium_IDE_Recorder' in window ||
    '_selenium' in window ||
    '__selenium_unwrapped' in window ||
    '__fxdriver_unwrapped' in window ||
    '__driver_unwrapped' in window ||
    'calledSelenium' in window ||
    '_WEBDRIVER_ELEM_CACHE' in window ||
    'ChromeDriverw' in window ||
    'driver-evaluate' in window ||
    'webdriver-evaluate' in window ||
    'selenium-evaluate' in window ||
    'webdriverCommand' in window ||
    'webdriver-evaluate-response' in window
  ) {
    features.selenium = true;
    detections.push('Selenium environment detected');
  }

  // Puppeteer detection
  if (
    'puppeteer' in window ||
    '_puppeteer' in window ||
    '__puppeteer_evaluation_script__' in window ||
    (window as any).__chrome_asyncScriptInfo ||
    (window as any).__puppeteer_evaluation_script__
  ) {
    features.puppeteer = true;
    detections.push('Puppeteer environment detected');
  }

  // Check for Chrome DevTools Protocol
  try {
    if ((window as any).chrome && (window as any).chrome.runtime) {
      const runtime = (window as any).chrome.runtime;
      if (runtime.onConnect || runtime.onMessage) {
        features.puppeteer = true;
        detections.push('Chrome DevTools Protocol detected');
      }
    }
  } catch (e) {
    // Ignore errors
  }

  // PhantomJS detection
  if (
    'callPhantom' in window ||
    '_phantom' in window ||
    'phantom' in window ||
    '__phantomjs' in window ||
    (window as any)._phantom ||
    (window as any).callPhantom
  ) {
    features.phantomjs = true;
    detections.push('PhantomJS environment detected');
  }

  // Playwright detection
  if (
    '__playwright_evaluation_script__' in window ||
    '_playwright' in window ||
    (window as any).__playwright_evaluation_script__
  ) {
    features.playwright = true;
    detections.push('Playwright environment detected');
  }

  // Additional framework checks
  const automationIndicators = [
    'domAutomation', 'domAutomationController', 'fxdriver',
    'geb', 'nightwatch', 'webdriver-sync', '__nightmare'
  ];
  
  for (const indicator of automationIndicators) {
    if (indicator in window) {
      detections.push(`Automation framework detected: ${indicator}`);
    }
  }
}

/**
 * Detect browser property anomalies
 */
function detectBrowserAnomalies(
  features: HeadlessFeatures,
  detections: string[]
): void {
  // Plugin anomalies
  const pluginCount = navigator.plugins.length;
  if (pluginCount === 0) {
    features.missingPlugins = true;
    detections.push('No browser plugins detected');
  }

  // User agent anomalies
  const ua = navigator.userAgent;
  if (
    ua.includes('HeadlessChrome') ||
    ua.includes('PhantomJS') ||
    ua.includes('SlimerJS') ||
    ua.includes('HtmlUnit') ||
    ua.includes('Headless')
  ) {
    features.suspiciousUserAgent = true;
    detections.push('Suspicious user agent detected');
  }

  // WebGL vendor/renderer anomalies
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        if (
          vendor.includes('SwiftShader') ||
          renderer.includes('SwiftShader') ||
          vendor === 'Brian Paul' ||
          renderer === 'Mesa OffScreen'
        ) {
          features.webglVendorRenderer = true;
          detections.push('Suspicious WebGL vendor/renderer');
        }
      }
    }
  } catch (e) {
    // WebGL not available
  }

  // Language anomalies
  const languages = navigator.languages;
  if (!languages || languages.length === 0) {
    features.languagesAnomaly = true;
    detections.push('No languages detected');
  } else if (languages.length === 1 && languages[0] === 'en-US') {
    features.languagesAnomaly = true;
    detections.push('Only default language detected');
  }

  // Timezone anomalies
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timezone || timezone === 'UTC') {
    features.timezoneAnomaly = true;
    detections.push('UTC timezone detected (common in headless)');
  }
}

/**
 * Detect runtime environment indicators
 */
function detectRuntimeEnvironment(
  features: HeadlessFeatures,
  detections: string[]
): void {
  // Chrome runtime anomalies
  try {
    if ((window as any).chrome) {
      const chrome = (window as any).chrome;
      if (chrome.runtime && chrome.runtime.onConnect) {
        features.chromeRuntime = true;
        detections.push('Chrome runtime detected');
      }
    }
  } catch (e) {
    // Ignore
  }

  // DevTools detection
  let devtools = false;
  const threshold = 160;
  
  if (
    window.outerHeight - window.innerHeight > threshold ||
    window.outerWidth - window.innerWidth > threshold
  ) {
    devtools = true;
  }

  // Console detection
  try {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      devtools = true;
    }
  } catch (e) {
    // Ignore
  }

  if (devtools) {
    features.debuggerOpen = true;
    detections.push('Developer tools detected');
  }

  // Automation controlled flag
  if ((navigator as any).webdriver === true) {
    features.automationControlled = true;
    detections.push('Browser under automation control');
  }

  // Check for missing expected properties
  const expectedProperties = [
    'chrome', 'safari', 'InstallTrigger', 'HTMLElement'
  ];
  
  let missingCount = 0;
  for (const prop of expectedProperties) {
    if (!(prop in window)) {
      missingCount++;
    }
  }
  
  if (missingCount > 2) {
    detections.push('Missing expected browser properties');
  }
}

/**
 * Detect performance and behavior anomalies
 */
async function detectPerformanceAnomalies(
  features: HeadlessFeatures,
  detections: string[]
): Promise<void> {
  // Execution speed test
  const start = performance.now();
  
  // Simulate some work
  let result = 0;
  for (let i = 0; i < 100000; i++) {
    result += Math.random();
  }
  
  const executionTime = performance.now() - start;
  
  // Headless browsers often execute JS much faster
  if (executionTime < 1) {
    features.tooFastExecution = true;
    detections.push('Unusually fast JavaScript execution');
  }

  // Check for mouse and keyboard event patterns
  // This would be enhanced with actual event monitoring
  if (!('onmouseenter' in document.documentElement)) {
    features.mouseMovementPattern = true;
    detections.push('Missing mouse event handlers');
  }

  // Memory and hardware checks
  if ((navigator as any).deviceMemory === undefined) {
    detections.push('Device memory API not available');
  }

  if ((navigator as any).hardwareConcurrency === undefined) {
    detections.push('Hardware concurrency not available');
  }

  // Check for missing APIs that are typically available in real browsers
  const expectedApis = [
    'requestIdleCallback',
    'IntersectionObserver',
    'MutationObserver'
  ];

  for (const api of expectedApis) {
    if (!(api in window)) {
      detections.push(`Missing API: ${api}`);
    }
  }
}

/**
 * Calculate headless detection score
 */
function calculateHeadlessScore(features: HeadlessFeatures): number {
  let score = 0;

  // High confidence indicators (30 points each)
  if (features.webdriver) score += 30;
  if (features.selenium) score += 30;
  if (features.puppeteer) score += 30;
  if (features.phantomjs) score += 30;
  if (features.playwright) score += 30;

  // Medium confidence indicators (15 points each)
  if (features.automationControlled) score += 15;
  if (features.phantomjsGlobal) score += 15;
  if (features.chromeRuntime) score += 15;

  // Lower confidence indicators (10 points each)
  if (features.missingPlugins) score += 10;
  if (features.suspiciousUserAgent) score += 10;
  if (features.webglVendorRenderer) score += 10;
  if (features.debuggerOpen) score += 10;

  // Behavioral indicators (5 points each)
  if (features.languagesAnomaly) score += 5;
  if (features.timezoneAnomaly) score += 5;
  if (features.tooFastExecution) score += 5;
  if (features.mouseMovementPattern) score += 5;

  return Math.min(score, 100);
}

/**
 * Quick headless detection for immediate use
 */
export async function isHeadlessBrowser(): Promise<boolean> {
  const result = await detectHeadlessBrowser();
  return result.isHeadless;
}

/**
 * Get headless detection summary
 */
export async function getHeadlessDetectionSummary(): Promise<{
  isHeadless: boolean;
  confidence: number;
  mainDetections: string[];
}> {
  const result = await detectHeadlessBrowser();
  
  return {
    isHeadless: result.isHeadless,
    confidence: result.confidence,
    mainDetections: result.detections.slice(0, 3) // Top 3 detections
  };
}

/**
 * Browser-specific headless detection
 */
export function detectSpecificHeadlessBrowser(): {
  chrome: boolean;
  firefox: boolean;
  safari: boolean;
  edge: boolean;
} {
  const ua = navigator.userAgent;
  
  return {
    chrome: ua.includes('HeadlessChrome') || 
           'webdriver' in navigator ||
           '__puppeteer_evaluation_script__' in window,
    firefox: ua.includes('Firefox') && navigator.plugins.length === 0,
    safari: ua.includes('Safari') && !ua.includes('Chrome') && navigator.plugins.length === 0,
    edge: ua.includes('Edge') && navigator.plugins.length === 0
  };
}

/**
 * Advanced evasion detection
 */
export function detectEvasionAttempts(): {
  userAgentOverride: boolean;
  pluginSpoofing: boolean;
  webglSpoofing: boolean;
  timestampManipulation: boolean;
} {
  let userAgentOverride = false;
  let pluginSpoofing = false;
  let webglSpoofing = false;
  let timestampManipulation = false;

  // Check for user agent override
  try {
    const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    if (descriptor && descriptor.get && descriptor.get.toString().includes('native code')) {
      userAgentOverride = false;
    } else {
      userAgentOverride = true;
    }
  } catch (e) {
    userAgentOverride = true;
  }

  // Check for plugin spoofing
  if (navigator.plugins.length > 0) {
    try {
      const plugin = navigator.plugins[0];
      if (!plugin.filename || plugin.filename === '') {
        pluginSpoofing = true;
      }
    } catch (e) {
      pluginSpoofing = true;
    }
  }

  // Check WebGL spoofing
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        if (vendor.includes('Google Inc.') && vendor.includes('ANGLE')) {
          // This could indicate spoofing
          webglSpoofing = true;
        }
      }
    }
  } catch (e) {
    webglSpoofing = true;
  }

  // Check timestamp manipulation
  const start = Date.now();
  const perf = performance.now();
  const end = Date.now();
  
  if (Math.abs((end - start) - (perf - performance.timeOrigin)) > 100) {
    timestampManipulation = true;
  }

  return {
    userAgentOverride,
    pluginSpoofing,
    webglSpoofing,
    timestampManipulation
  };
}