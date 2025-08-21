/**
 * Headless Browser Detector
 * Detects headless browsers and automation frameworks
 */

import { DetectorResult, RequestContext } from '../types';
import { HEADLESS_INDICATORS } from '../constants';

export class HeadlessDetector {
  detect(context: RequestContext): DetectorResult {
    const indicators: string[] = [];
    let confidence = 0;

    // Check user agent for headless patterns
    const uaIndicators = this.checkUserAgent(context.userAgent);
    if (uaIndicators.length > 0) {
      indicators.push(...uaIndicators);
      confidence = Math.max(confidence, 0.9);
    }

    // Check headers for automation indicators
    const headerIndicators = this.checkHeaders(context.headers);
    if (headerIndicators.length > 0) {
      indicators.push(...headerIndicators);
      confidence = Math.max(confidence, 0.85);
    }

    // Check fingerprint for headless indicators
    if (context.fingerprint) {
      const fpIndicators = this.checkFingerprint(context.fingerprint);
      if (fpIndicators.length > 0) {
        indicators.push(...fpIndicators);
        confidence = Math.max(confidence, 0.95);
      }
    }

    // Check for specific headless detection results
    if (context.fingerprint?.headlessDetection) {
      const headlessData = context.fingerprint.headlessDetection;
      if (headlessData.isHeadless) {
        indicators.push(...headlessData.detections);
        confidence = Math.max(confidence, headlessData.confidence);
      }
    }

    const detected = indicators.length > 0;
    const type = this.determineHeadlessType(indicators);

    return {
      detected,
      confidence: detected ? confidence : 0,
      type,
      indicators
    };
  }

  private checkUserAgent(userAgent: string): string[] {
    const ua = userAgent.toLowerCase();
    const indicators: string[] = [];

    // Check for headless patterns in user agent
    for (const pattern of HEADLESS_INDICATORS.userAgentPatterns) {
      if (ua.includes(pattern)) {
        indicators.push(`ua_contains_${pattern}`);
      }
    }

    // Check for missing browser token in headless Chrome/Firefox
    if (ua.includes('chrome') && !ua.includes('chrome/')) {
      indicators.push('malformed_chrome_ua');
    }

    if (ua.includes('firefox') && !ua.includes('firefox/')) {
      indicators.push('malformed_firefox_ua');
    }

    // Check for HeadlessChrome identifier
    if (ua.includes('headlesschrome')) {
      indicators.push('headless_chrome_identifier');
    }

    return indicators;
  }

  private checkHeaders(headers: Record<string, string>): string[] {
    const indicators: string[] = [];
    const normalizedHeaders = this.normalizeHeaders(headers);

    // Check for automation-specific headers
    const automationHeaders = [
      'x-automation',
      'x-webdriver',
      'x-selenium',
      'x-puppeteer',
      'x-playwright',
      'webdriver-active',
      'x-chrome-connected',
      'x-devtools-emulate-network-conditions-client-id'
    ];

    for (const header of automationHeaders) {
      if (normalizedHeaders[header]) {
        indicators.push(`automation_header_${header}`);
      }
    }

    // Check for missing expected headers in headless
    if (!normalizedHeaders['accept-language']) {
      indicators.push('missing_accept_language');
    }

    if (!normalizedHeaders['accept-encoding']) {
      indicators.push('missing_accept_encoding');
    }

    // Check for suspicious header combinations
    if (normalizedHeaders['user-agent'] && !normalizedHeaders['accept']) {
      indicators.push('ua_without_accept_header');
    }

    return indicators;
  }

  private checkFingerprint(fingerprint: any): string[] {
    const indicators: string[] = [];

    // Check WebGL renderer for virtual/headless indicators
    if (fingerprint.webgl?.renderer) {
      const renderer = fingerprint.webgl.renderer.toLowerCase();
      if (renderer.includes('swiftshader') || 
          renderer.includes('llvmpipe') || 
          renderer.includes('mesa')) {
        indicators.push('virtual_gpu_renderer');
      }
    }

    // Check for missing plugins (common in headless)
    if (fingerprint.environment?.plugins?.length === 0) {
      indicators.push('no_browser_plugins');
    }

    // Check for automation properties
    if (fingerprint.environment?.webdriver === true) {
      indicators.push('webdriver_property_true');
    }

    // Check for missing permissions API
    if (fingerprint.environment?.permissions === false) {
      indicators.push('no_permissions_api');
    }

    // Check screen dimensions
    if (fingerprint.screen) {
      const { width, height, availWidth, availHeight } = fingerprint.screen;
      
      // In headless, available dimensions often equal total dimensions
      if (width === availWidth && height === availHeight) {
        indicators.push('fullscreen_available_dimensions');
      }

      // Check for common headless resolutions
      const resolution = `${width}x${height}`;
      const headlessResolutions = ['800x600', '1024x768', '1280x720', '1920x1080'];
      if (headlessResolutions.includes(resolution)) {
        indicators.push('common_headless_resolution');
      }
    }

    // Check timezone
    if (fingerprint.environment?.timezone === 'UTC') {
      indicators.push('utc_timezone');
    }

    // Check languages
    if (fingerprint.environment?.languages?.length === 1 && 
        fingerprint.environment.languages[0] === 'en-US') {
      indicators.push('single_default_language');
    }

    // Check for CDP (Chrome DevTools Protocol) properties
    if (fingerprint.cdp?.active === true) {
      indicators.push('chrome_devtools_active');
    }

    return indicators;
  }

  private normalizeHeaders(headers: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  private determineHeadlessType(indicators: string[]): string | undefined {
    // Try to determine specific headless browser type
    if (indicators.some(i => i.includes('puppeteer'))) {
      return 'puppeteer';
    }
    if (indicators.some(i => i.includes('selenium') || i.includes('webdriver'))) {
      return 'selenium';
    }
    if (indicators.some(i => i.includes('playwright'))) {
      return 'playwright';
    }
    if (indicators.some(i => i.includes('phantom'))) {
      return 'phantomjs';
    }
    if (indicators.some(i => i.includes('headless_chrome'))) {
      return 'headless_chrome';
    }
    if (indicators.some(i => i.includes('headless')) && indicators.some(i => i.includes('firefox'))) {
      return 'headless_firefox';
    }

    // Generic headless if we can't determine specific type
    if (indicators.length > 2) {
      return 'unknown_headless';
    }

    return undefined;
  }
}