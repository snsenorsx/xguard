/**
 * Advanced Browser Fingerprinting System
 * Collects comprehensive browser, hardware, and environment data
 */

import { detectHeadlessBrowser, type HeadlessDetectionResult } from './headlessDetection';

export interface AdvancedFingerprint {
  // Canvas fingerprinting
  canvas: {
    hash: string;
    geometry: string;
    text: string;
  };
  
  // WebGL fingerprinting
  webgl: {
    vendor: string;
    renderer: string;
    version: string;
    shadingLanguageVersion: string;
    extensions: string[];
    parameters: Record<string, any>;
    hash: string;
  };
  
  // Audio context fingerprinting
  audio: {
    contextHash: string;
    compressorHash: string;
    oscillatorHash: string;
    sampleRate: number;
    maxChannelCount: number;
    baseLatency?: number;
  };
  
  // Screen & Hardware
  screen: {
    resolution: string;
    colorDepth: number;
    pixelRatio: number;
    orientation: string;
    availableResolution: string;
    brightness?: number;
  };
  
  // Device sensors & capabilities
  device: {
    hardwareConcurrency: number;
    maxTouchPoints: number;
    deviceMemory?: number;
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
    };
    battery?: {
      level: number;
      charging: boolean;
      dischargingTime: number;
    };
  };
  
  // Browser environment
  environment: {
    timezone: string;
    timezoneOffset: number;
    languages: string[];
    platform: string;
    cookieEnabled: boolean;
    doNotTrack: string | null;
    plugins: Array<{
      name: string;
      description: string;
      filename: string;
    }>;
  };
  
  // Performance characteristics
  performance: {
    renderingTime: number;
    canvasRenderTime: number;
    webglRenderTime: number;
    audioProcessingTime: number;
  };

  // Headless browser detection results
  headlessDetection: HeadlessDetectionResult;
}

/**
 * Generate Canvas Fingerprint
 */
export async function generateCanvasFingerprint(): Promise<{ hash: string; geometry: string; text: string }> {
  const startTime = performance.now();
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return { hash: 'no-canvas', geometry: 'no-canvas', text: 'no-canvas' };
    }
    
    canvas.width = 280;
    canvas.height = 60;
    
    // Text rendering with various fonts and styles
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    
    ctx.fillStyle = '#069';
    ctx.font = '11px no-such-font-' + Math.random();
    ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃', 2, 15);
    
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.font = '18px Arial';
    ctx.fillText('RPC Cloaker Test 🚀', 4, 35);
    
    // Geometry rendering
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = 'rgb(0,255,255)';
    ctx.beginPath();
    ctx.arc(100, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = 'rgb(255,255,0)';
    ctx.beginPath();
    ctx.arc(75, 100, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    
    const dataURL = canvas.toDataURL();
    const textData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // Generate hashes
    const hash = await sha256(dataURL);
    const geometry = await sha256(dataURL.slice(0, 100)); // Geometry part
    const text = await sha256(Array.from(textData.slice(0, 100)).join(',')); // Text part
    
    return { hash, geometry, text };
  } catch (error) {
    console.error('Canvas fingerprinting error:', error);
    return { hash: 'error', geometry: 'error', text: 'error' };
  }
}

/**
 * Generate WebGL Fingerprint
 */
export async function generateWebGLFingerprint(): Promise<AdvancedFingerprint['webgl']> {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    
    if (!gl) {
      return {
        vendor: 'no-webgl',
        renderer: 'no-webgl', 
        version: 'no-webgl',
        shadingLanguageVersion: 'no-webgl',
        extensions: [],
        parameters: {},
        hash: 'no-webgl'
      };
    }
    
    // Basic info
    const vendor = gl.getParameter(gl.VENDOR) || 'unknown';
    const renderer = gl.getParameter(gl.RENDERER) || 'unknown';
    const version = gl.getParameter(gl.VERSION) || 'unknown';
    const shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || 'unknown';
    
    // Extensions
    const extensions = gl.getSupportedExtensions() || [];
    
    // Advanced parameters
    const parameters: Record<string, any> = {};
    const paramNames = [
      'MAX_VERTEX_ATTRIBS',
      'MAX_VERTEX_UNIFORM_VECTORS', 
      'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
      'MAX_VARYING_VECTORS',
      'MAX_FRAGMENT_UNIFORM_VECTORS',
      'MAX_TEXTURE_IMAGE_UNITS',
      'MAX_TEXTURE_SIZE',
      'MAX_CUBE_MAP_TEXTURE_SIZE',
      'MAX_RENDERBUFFER_SIZE',
      'MAX_VIEWPORT_DIMS',
      'ALIASED_LINE_WIDTH_RANGE',
      'ALIASED_POINT_SIZE_RANGE'
    ];
    
    paramNames.forEach(name => {
      try {
        const param = (gl as any)[name];
        if (param) {
          parameters[name] = gl.getParameter(param);
        }
      } catch (e) {
        // Ignore parameter errors
      }
    });
    
    // Generate comprehensive hash
    const fingerprint = JSON.stringify({
      vendor,
      renderer,
      version,
      shadingLanguageVersion,
      extensions: extensions.sort(),
      parameters
    });
    
    const hash = await sha256(fingerprint);
    
    return {
      vendor,
      renderer,
      version,
      shadingLanguageVersion,
      extensions,
      parameters,
      hash
    };
  } catch (error) {
    console.error('WebGL fingerprinting error:', error);
    return {
      vendor: 'error',
      renderer: 'error',
      version: 'error', 
      shadingLanguageVersion: 'error',
      extensions: [],
      parameters: {},
      hash: 'error'
    };
  }
}

/**
 * Generate Audio Context Fingerprint
 */
export async function generateAudioFingerprint(): Promise<AdvancedFingerprint['audio']> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Basic properties
    const sampleRate = audioContext.sampleRate;
    const maxChannelCount = audioContext.destination.maxChannelCount;
    const baseLatency = audioContext.baseLatency;
    
    // Oscillator test
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
    
    compressor.threshold.setValueAtTime(-50, audioContext.currentTime);
    compressor.knee.setValueAtTime(40, audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, audioContext.currentTime);
    compressor.attack.setValueAtTime(0, audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, audioContext.currentTime);
    
    oscillator.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioContext.destination);
    
    oscillator.start(0);
    oscillator.stop(0.1);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate fingerprints
    const contextFingerprint = JSON.stringify({
      sampleRate,
      maxChannelCount,
      baseLatency: baseLatency || 0,
      state: audioContext.state
    });
    
    const compressorFingerprint = JSON.stringify({
      threshold: compressor.threshold.value,
      knee: compressor.knee.value,
      ratio: compressor.ratio.value,
      attack: compressor.attack.value,
      release: compressor.release.value
    });
    
    const oscillatorFingerprint = JSON.stringify({
      frequency: oscillator.frequency.value,
      type: oscillator.type
    });
    
    const contextHash = await sha256(contextFingerprint);
    const compressorHash = await sha256(compressorFingerprint);
    const oscillatorHash = await sha256(oscillatorFingerprint);
    
    // Cleanup
    audioContext.close();
    
    return {
      contextHash,
      compressorHash,
      oscillatorHash,
      sampleRate,
      maxChannelCount,
      baseLatency
    };
  } catch (error) {
    console.error('Audio fingerprinting error:', error);
    return {
      contextHash: 'error',
      compressorHash: 'error', 
      oscillatorHash: 'error',
      sampleRate: 0,
      maxChannelCount: 0
    };
  }
}

/**
 * Collect Device Information
 */
export async function collectDeviceInfo(): Promise<AdvancedFingerprint['device']> {
  const device: AdvancedFingerprint['device'] = {
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0
  };
  
  // Device memory (Chrome only)
  if ('deviceMemory' in navigator) {
    device.deviceMemory = (navigator as any).deviceMemory;
  }
  
  // Network information
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    device.connection = {
      effectiveType: conn.effectiveType || 'unknown',
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0
    };
  }
  
  // Battery information
  try {
    if ('getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();
      device.battery = {
        level: battery.level,
        charging: battery.charging,
        dischargingTime: battery.dischargingTime
      };
    }
  } catch (error) {
    // Battery API may be restricted
  }
  
  return device;
}

/**
 * Generate comprehensive advanced fingerprint
 */
export async function generateAdvancedFingerprint(): Promise<AdvancedFingerprint> {
  const startTime = performance.now();
  
  // Run all fingerprinting in parallel for performance
  const [canvas, webgl, audio, device] = await Promise.all([
    generateCanvasFingerprint(),
    generateWebGLFingerprint(),
    generateAudioFingerprint(),
    collectDeviceInfo()
  ]);
  
  const canvasTime = performance.now();
  const webglTime = performance.now();
  const audioTime = performance.now();
  const endTime = performance.now();
  
  return {
    canvas,
    webgl,
    audio,
    screen: {
      resolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type || 'unknown',
      availableResolution: `${screen.availWidth}x${screen.availHeight}`
    },
    device,
    environment: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      languages: Array.from(navigator.languages),
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      plugins: Array.from(navigator.plugins).map(plugin => ({
        name: plugin.name,
        description: plugin.description,
        filename: plugin.filename
      }))
    },
    performance: {
      renderingTime: endTime - startTime,
      canvasRenderTime: canvasTime - startTime,
      webglRenderTime: webglTime - canvasTime,
      audioProcessingTime: audioTime - webglTime
    },
    headlessDetection: await detectHeadlessBrowser()
  };
}

/**
 * SHA-256 hash function
 */
async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    // Fallback to simple hash if crypto.subtle not available
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}