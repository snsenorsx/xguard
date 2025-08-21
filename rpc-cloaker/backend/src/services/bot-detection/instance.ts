/**
 * Bot Detection Service Instance
 */

import { BotDetectionService } from './bot-detection.service';

let instance: BotDetectionService | null = null;

export function getBotDetectionService(): BotDetectionService {
  if (!instance) {
    instance = new BotDetectionService({
      enabled: process.env.BOT_DETECTION_ENABLED !== 'false',
      thresholds: {
        bot: parseFloat(process.env.BOT_THRESHOLD || '0.7'),
        suspicious: parseFloat(process.env.SUSPICIOUS_THRESHOLD || '0.5')
      }
    });
  }
  return instance;
}