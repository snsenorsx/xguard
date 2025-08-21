/**
 * Fingerprint Analyzer
 * Analyzes browser fingerprint data for anomalies and bot indicators
 */

import { AnalyzerResult, RequestContext } from '../types';

export class FingerprintAnalyzer {
  analyze(context: RequestContext): AnalyzerResult {
    const fingerprint = context.fingerprint;
    const flags: string[] = [];
    let score = 0;

    // If no fingerprint data, it's suspicious
    if (!fingerprint) {
      return {
        score: 0.7,
        confidence: 0.8,
        flags: ['no_fingerprint_data'],
        details: { reason: 'No fingerprint data provided' }
      };
    }

    // Analyze canvas fingerprint
    if (fingerprint.canvas) {
      const canvasFlags = this.analyzeCanvas(fingerprint.canvas);
      flags.push(...canvasFlags);
      if (canvasFlags.length > 0) {
        score = Math.max(score, 0.6);
      }
    } else {
      flags.push('missing_canvas_fingerprint');
      score = Math.max(score, 0.5);
    }

    // Analyze WebGL fingerprint
    if (fingerprint.webgl) {
      const webglFlags = this.analyzeWebGL(fingerprint.webgl);
      flags.push(...webglFlags);
      if (webglFlags.length > 0) {
        score = Math.max(score, 0.7);
      }
    } else {
      flags.push('missing_webgl_fingerprint');
      score = Math.max(score, 0.5);
    }

    // Analyze audio fingerprint
    if (fingerprint.audio) {
      const audioFlags = this.analyzeAudio(fingerprint.audio);
      flags.push(...audioFlags);
      if (audioFlags.length > 0) {
        score = Math.max(score, 0.6);
      }
    }

    // Analyze screen data
    if (fingerprint.screen) {
      const screenFlags = this.analyzeScreen(fingerprint.screen);
      flags.push(...screenFlags);
      if (screenFlags.length > 0) {
        score = Math.max(score, 0.7);
      }
    } else {
      flags.push('missing_screen_data');
      score = Math.max(score, 0.6);
    }

    // Analyze device data
    if (fingerprint.device) {
      const deviceFlags = this.analyzeDevice(fingerprint.device);
      flags.push(...deviceFlags);
      if (deviceFlags.length > 0) {
        score = Math.max(score, 0.7);
      }
    }

    // Analyze environment data
    if (fingerprint.environment) {
      const envFlags = this.analyzeEnvironment(fingerprint.environment);
      flags.push(...envFlags);
      if (envFlags.length > 0) {
        score = Math.max(score, 0.8);
      }
    }

    // Check for consistency across fingerprints
    const consistencyFlags = this.checkConsistency(fingerprint);
    flags.push(...consistencyFlags);
    if (consistencyFlags.length > 0) {
      score = Math.max(score, 0.85);
    }

    return {
      score,
      confidence: this.calculateConfidence(flags, fingerprint),
      flags,
      details: {
        hasCanvas: !!fingerprint.canvas,
        hasWebGL: !!fingerprint.webgl,
        hasAudio: !!fingerprint.audio,
        anomalyCount: flags.length
      }
    };
  }

  private analyzeCanvas(canvas: any): string[] {
    const flags: string[] = [];

    // Check if canvas is blocked or returns empty/default
    if (canvas.isBlocked || canvas.isEmpty) {
      flags.push('canvas_blocked_or_empty');
    }

    // Check for known bot canvas hashes
    if (canvas.hash) {
      const knownBotHashes = [
        'd3d3d3d3d3d3d3d3', // Common default
        '0000000000000000', // All zeros
        'ffffffffffffffff'  // All ones
      ];
      
      if (knownBotHashes.includes(canvas.hash.substring(0, 16))) {
        flags.push('suspicious_canvas_hash');
      }
    }

    // Check if text rendering is suspicious
    if (canvas.textMetrics && canvas.textMetrics.width === 0) {
      flags.push('zero_width_text_rendering');
    }

    return flags;
  }

  private analyzeWebGL(webgl: any): string[] {
    const flags: string[] = [];

    // Check for headless/virtual renderers
    if (webgl.renderer) {
      const renderer = webgl.renderer.toLowerCase();
      const suspiciousRenderers = [
        'swiftshader',
        'llvmpipe',
        'mesa offscreen',
        'brian paul',
        'vmware',
        'virtualbox'
      ];

      for (const suspicious of suspiciousRenderers) {
        if (renderer.includes(suspicious)) {
          flags.push(`virtual_renderer_${suspicious.replace(/\s+/g, '_')}`);
          break;
        }
      }
    }

    // Check for missing WebGL support (common in headless)
    if (!webgl.supported) {
      flags.push('webgl_not_supported');
    }

    // Check for suspicious vendor
    if (webgl.vendor) {
      const vendor = webgl.vendor.toLowerCase();
      if (vendor === 'brian paul' || vendor === 'mesa' || vendor.includes('webkit')) {
        flags.push('suspicious_webgl_vendor');
      }
    }

    return flags;
  }

  private analyzeAudio(audio: any): string[] {
    const flags: string[] = [];

    // Check if audio context is blocked
    if (audio.state === 'suspended' || audio.state === 'closed') {
      flags.push('audio_context_blocked');
    }

    // Check for default/suspicious values
    if (audio.sampleRate === 44100 && audio.channelCount === 2 && audio.maxChannelCount === 2) {
      // These are very common defaults, but if ALL are default, it might be suspicious
      if (!audio.oscillatorHash || audio.oscillatorHash === audio.dynamicsHash) {
        flags.push('all_audio_values_default');
      }
    }

    return flags;
  }

  private analyzeScreen(screen: any): string[] {
    const flags: string[] = [];

    // Check for headless browser screen sizes
    const headlessResolutions = [
      '800x600',
      '1024x768',
      '1280x720',
      '1280x800',
      '1920x1080'
    ];

    const resolution = `${screen.width}x${screen.height}`;
    if (headlessResolutions.includes(resolution) && screen.width === screen.availWidth) {
      flags.push('common_headless_resolution');
    }

    // Check color depth
    if (screen.colorDepth < 24) {
      flags.push('low_color_depth');
    }

    // Check for no screen orientation (headless)
    if (!screen.orientation) {
      flags.push('no_screen_orientation');
    }

    return flags;
  }

  private analyzeDevice(device: any): string[] {
    const flags: string[] = [];

    // Check hardware concurrency
    if (device.hardwareConcurrency === 0 || device.hardwareConcurrency > 64) {
      flags.push('suspicious_hardware_concurrency');
    }

    // Check device memory (if available)
    if (device.memory === 0 || device.memory > 64) {
      flags.push('suspicious_device_memory');
    }

    // Check max touch points
    if (device.maxTouchPoints === undefined) {
      flags.push('no_touch_support_data');
    }

    return flags;
  }

  private analyzeEnvironment(env: any): string[] {
    const flags: string[] = [];

    // Check timezone
    if (env.timezone === 'UTC' || env.timezoneOffset === 0) {
      flags.push('utc_timezone');
    }

    // Check languages
    if (!env.languages || env.languages.length === 0) {
      flags.push('no_languages');
    } else if (env.languages.length === 1 && env.languages[0] === 'en-US') {
      flags.push('default_language_only');
    }

    // Check plugins
    if (env.plugins && env.plugins.length === 0) {
      flags.push('no_browser_plugins');
    }

    // Check platform
    if (env.platform === 'Unknown' || !env.platform) {
      flags.push('unknown_platform');
    }

    return flags;
  }

  private checkConsistency(fingerprint: any): string[] {
    const flags: string[] = [];

    // Check screen vs viewport consistency
    if (fingerprint.screen && fingerprint.environment) {
      const { width, height } = fingerprint.screen;
      const { viewportWidth, viewportHeight } = fingerprint.environment;

      if (viewportWidth > width || viewportHeight > height) {
        flags.push('viewport_larger_than_screen');
      }
    }

    // Check device vs user agent consistency
    if (fingerprint.device && fingerprint.environment) {
      const isMobile = fingerprint.device.maxTouchPoints > 0;
      const platform = fingerprint.environment.platform?.toLowerCase() || '';
      
      if (isMobile && !platform.match(/android|iphone|ipad|mobile/i)) {
        flags.push('touch_device_desktop_platform');
      }
    }

    return flags;
  }

  private calculateConfidence(flags: string[], fingerprint: any): number {
    // Higher confidence with more specific indicators
    if (flags.some(f => f.includes('virtual_renderer_') || f.includes('canvas_blocked'))) {
      return 0.9;
    }

    if (flags.filter(f => f.startsWith('missing_')).length >= 3) {
      return 0.85;
    }

    if (flags.includes('utc_timezone') && flags.includes('no_browser_plugins')) {
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