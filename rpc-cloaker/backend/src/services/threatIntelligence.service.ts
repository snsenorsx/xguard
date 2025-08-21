/**
 * Legacy Threat Intelligence Service Export
 * This file maintains backward compatibility
 * Use the new modular version from './threat-intelligence' instead
 */

export * from './threat-intelligence';

// Re-export for backward compatibility
import { getThreatIntelligenceService as getService } from './threat-intelligence';
export const getThreatIntelligenceService = getService;