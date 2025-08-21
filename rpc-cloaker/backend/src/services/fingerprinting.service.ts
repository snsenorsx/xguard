/**
 * Fingerprinting Service
 * Analyzes browser fingerprints for anomalies
 */

export class FingerprintingService {
  static async analyze(fingerprint: any): Promise<{
    anomalyScore: number;
    ja3Match?: boolean;
  } | null> {
    if (!fingerprint) {
      return null;
    }

    let anomalyScore = 0;
    const anomalies: string[] = [];

    // Check canvas fingerprint
    if (fingerprint.canvas) {
      if (fingerprint.canvas.isBlocked || fingerprint.canvas.isEmpty) {
        anomalyScore += 0.3;
        anomalies.push('canvas_blocked');
      }
    } else {
      anomalyScore += 0.2;
      anomalies.push('missing_canvas');
    }

    // Check WebGL
    if (fingerprint.webgl) {
      const renderer = fingerprint.webgl.renderer?.toLowerCase() || '';
      if (renderer.includes('swiftshader') || renderer.includes('llvmpipe')) {
        anomalyScore += 0.3;
        anomalies.push('virtual_renderer');
      }
    } else {
      anomalyScore += 0.2;
      anomalies.push('missing_webgl');
    }

    // Check audio
    if (fingerprint.audio && fingerprint.audio.state === 'suspended') {
      anomalyScore += 0.1;
      anomalies.push('audio_suspended');
    }

    // Check JA3
    const ja3Match = fingerprint.ja3 && fingerprint.ja3.length > 0;

    return {
      anomalyScore: Math.min(anomalyScore, 1.0),
      ja3Match
    };
  }
}