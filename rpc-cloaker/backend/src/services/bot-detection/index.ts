/**
 * Bot Detection Service - Main Entry Point
 * Modular architecture for easy maintenance and development
 */

export { BotDetectionService } from './bot-detection.service';
export { UserAgentAnalyzer } from './analyzers/user-agent.analyzer';
export { HeaderAnalyzer } from './analyzers/header.analyzer';
export { NetworkAnalyzer } from './analyzers/network.analyzer';
export { FingerprintAnalyzer } from './analyzers/fingerprint.analyzer';
export { HeadlessDetector } from './detectors/headless.detector';
export { BehaviorAnalyzer } from './analyzers/behavior.analyzer';
export { getBotDetectionService } from './instance';

export type {
  BotDetectionResult,
  BotDetectionConfig,
  AnalyzerResult,
  DetectorResult
} from './types';