import { useState, useEffect, useCallback } from 'react';
import { generateAdvancedFingerprint, type AdvancedFingerprint } from '@/utils/fingerprinting';

interface FingerprintingState {
  fingerprint: AdvancedFingerprint | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

interface FingerprintingOptions {
  autoGenerate?: boolean;
  cacheTimeout?: number; // in milliseconds
  onComplete?: (fingerprint: AdvancedFingerprint) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for advanced browser fingerprinting
 */
export function useFingerprinting(options: FingerprintingOptions = {}) {
  const {
    autoGenerate = true,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes default
    onComplete,
    onError
  } = options;

  const [state, setState] = useState<FingerprintingState>({
    fingerprint: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  /**
   * Generate new fingerprint
   */
  const generateFingerprint = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const startTime = Date.now();
      const fingerprint = await generateAdvancedFingerprint();
      const endTime = Date.now();

      console.log(`🔍 Fingerprinting completed in ${endTime - startTime}ms`);
      
      setState({
        fingerprint,
        isLoading: false,
        error: null,
        lastUpdated: endTime
      });

      // Store in sessionStorage for performance
      try {
        sessionStorage.setItem('rpc_fingerprint', JSON.stringify({
          fingerprint,
          timestamp: endTime
        }));
      } catch (e) {
        console.warn('Could not cache fingerprint in sessionStorage:', e);
      }

      onComplete?.(fingerprint);
      return fingerprint;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fingerprinting error';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      console.error('Fingerprinting failed:', error);
      onError?.(errorMessage);
      throw error;
    }
  }, [onComplete, onError]);

  /**
   * Load cached fingerprint if available and not expired
   */
  const loadCachedFingerprint = useCallback(() => {
    try {
      const cached = sessionStorage.getItem('rpc_fingerprint');
      if (!cached) return false;

      const { fingerprint, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < cacheTimeout) {
        setState({
          fingerprint,
          isLoading: false,
          error: null,
          lastUpdated: timestamp
        });
        
        console.log('🔍 Loaded cached fingerprint');
        onComplete?.(fingerprint);
        return true;
      } else {
        // Clear expired cache
        sessionStorage.removeItem('rpc_fingerprint');
        return false;
      }
    } catch (error) {
      console.warn('Could not load cached fingerprint:', error);
      sessionStorage.removeItem('rpc_fingerprint');
      return false;
    }
  }, [cacheTimeout, onComplete]);

  /**
   * Force refresh fingerprint (bypass cache)
   */
  const refreshFingerprint = useCallback(async () => {
    sessionStorage.removeItem('rpc_fingerprint');
    return generateFingerprint();
  }, [generateFingerprint]);

  /**
   * Check if fingerprint needs update
   */
  const needsUpdate = useCallback(() => {
    if (!state.lastUpdated) return true;
    return Date.now() - state.lastUpdated > cacheTimeout;
  }, [state.lastUpdated, cacheTimeout]);

  /**
   * Get fingerprint hash for quick identification
   */
  const getFingerprintHash = useCallback(() => {
    if (!state.fingerprint) return null;
    
    // Create a combined hash from key fingerprint components
    const keyComponents = [
      state.fingerprint.canvas.hash,
      state.fingerprint.webgl.hash,
      state.fingerprint.audio.contextHash,
      state.fingerprint.screen.resolution,
      state.fingerprint.device.hardwareConcurrency.toString()
    ].join('|');

    return btoa(keyComponents).slice(0, 32);
  }, [state.fingerprint]);

  /**
   * Auto-generate on mount
   */
  useEffect(() => {
    if (!autoGenerate) return;

    // Try to load from cache first
    const loaded = loadCachedFingerprint();
    
    // If no valid cache, generate new fingerprint
    if (!loaded) {
      generateFingerprint().catch(error => {
        console.error('Auto-fingerprinting failed:', error);
      });
    }
  }, [autoGenerate, loadCachedFingerprint, generateFingerprint]);

  /**
   * Auto-refresh when cache expires
   */
  useEffect(() => {
    if (!autoGenerate || !state.lastUpdated) return;

    const timeUntilExpiry = cacheTimeout - (Date.now() - state.lastUpdated);
    
    if (timeUntilExpiry <= 0) {
      generateFingerprint().catch(error => {
        console.error('Auto-refresh fingerprinting failed:', error);
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      generateFingerprint().catch(error => {
        console.error('Auto-refresh fingerprinting failed:', error);
      });
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [autoGenerate, state.lastUpdated, cacheTimeout, generateFingerprint]);

  return {
    // State
    fingerprint: state.fingerprint,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Actions
    generateFingerprint,
    refreshFingerprint,
    loadCachedFingerprint,
    
    // Utilities
    needsUpdate,
    getFingerprintHash,
    
    // Computed values
    isReady: !!state.fingerprint && !state.isLoading,
    isCached: !!state.lastUpdated && Date.now() - state.lastUpdated < cacheTimeout,
    cacheAge: state.lastUpdated ? Date.now() - state.lastUpdated : null
  };
}

/**
 * Get fingerprint for immediate use (promise-based)
 */
export async function getFingerprint(forceRefresh = false): Promise<AdvancedFingerprint> {
  // Try cache first unless forced refresh
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem('rpc_fingerprint');
      if (cached) {
        const { fingerprint, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          return fingerprint;
        }
      }
    } catch (error) {
      console.warn('Failed to load cached fingerprint:', error);
    }
  }

  // Generate new fingerprint
  return generateAdvancedFingerprint();
}

/**
 * Compare two fingerprints for similarity
 */
export function compareFingerprintSimilarity(
  fp1: AdvancedFingerprint,
  fp2: AdvancedFingerprint
): number {
  let matches = 0;
  let total = 0;

  // Canvas comparison
  total += 3;
  if (fp1.canvas.hash === fp2.canvas.hash) matches++;
  if (fp1.canvas.geometry === fp2.canvas.geometry) matches++;
  if (fp1.canvas.text === fp2.canvas.text) matches++;

  // WebGL comparison
  total += 4;
  if (fp1.webgl.vendor === fp2.webgl.vendor) matches++;
  if (fp1.webgl.renderer === fp2.webgl.renderer) matches++;
  if (fp1.webgl.version === fp2.webgl.version) matches++;
  if (fp1.webgl.hash === fp2.webgl.hash) matches++;

  // Screen comparison
  total += 2;
  if (fp1.screen.resolution === fp2.screen.resolution) matches++;
  if (fp1.screen.colorDepth === fp2.screen.colorDepth) matches++;

  // Device comparison
  total += 2;
  if (fp1.device.hardwareConcurrency === fp2.device.hardwareConcurrency) matches++;
  if (fp1.device.maxTouchPoints === fp2.device.maxTouchPoints) matches++;

  // Environment comparison
  total += 3;
  if (fp1.environment.timezone === fp2.environment.timezone) matches++;
  if (fp1.environment.platform === fp2.environment.platform) matches++;
  if (JSON.stringify(fp1.environment.languages) === JSON.stringify(fp2.environment.languages)) matches++;

  return matches / total;
}