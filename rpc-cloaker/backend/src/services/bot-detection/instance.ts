import { BotDetectionService } from './bot-detection.service';

let instance: BotDetectionService | null = null;

export function getBotDetectionService(): BotDetectionService {
  if (!instance) {
    instance = new BotDetectionService();
  }
  return instance;
}