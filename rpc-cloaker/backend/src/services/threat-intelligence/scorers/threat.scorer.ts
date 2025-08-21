/**
 * Threat Scorer
 * Calculates overall threat assessment from multiple sources
 */

import { ThreatSource, ThreatIntelligenceResult } from '../types';
import { HIGH_RISK_CATEGORIES } from '../constants';

export class ThreatScorer {
  private weights: { [provider: string]: number };
  private minimumConfidence: number;
  private autoBlacklistThreshold: number;

  constructor(config: {
    weights: { [provider: string]: number };
    minimumConfidence: number;
    autoBlacklistThreshold: number;
  }) {
    this.weights = config.weights;
    this.minimumConfidence = config.minimumConfidence;
    this.autoBlacklistThreshold = config.autoBlacklistThreshold;
  }

  /**
   * Calculate overall threat assessment from multiple sources
   */
  calculateThreatAssessment(
    ipAddress: string,
    sources: ThreatSource[]
  ): Omit<ThreatIntelligenceResult, 'lastChecked' | 'cached'> {
    if (sources.length === 0) {
      return {
        ipAddress,
        isMalicious: false,
        isThreat: false,
        confidence: 0,
        sources: [],
        categories: [],
        reason: 'No threat data available'
      };
    }

    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    const allCategories = new Set<string>();
    const reasons: string[] = [];

    for (const source of sources) {
      const weight = this.weights[source.name] || 0.5;
      totalScore += source.score * weight;
      totalWeight += weight;

      // Collect categories
      source.categories.forEach(cat => allCategories.add(cat));

      // Collect high-confidence threats
      if (source.score >= 50) {
        reasons.push(`${source.name}: ${source.score}% confidence`);
      }
    }

    // Normalize score
    const confidence = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    // Determine threat status
    const isThreat = confidence >= this.minimumConfidence;
    const isMalicious = confidence >= this.autoBlacklistThreshold;

    // Check for high-risk categories
    const hasHighRiskCategory = sources.some(source => 
      source.categories.some(cat => 
        HIGH_RISK_CATEGORIES.some(highRisk => 
          cat.toLowerCase().includes(highRisk.toString())
        )
      )
    );

    // Adjust for high-risk categories
    const adjustedIsMalicious = isMalicious || 
      (hasHighRiskCategory && confidence >= this.minimumConfidence);

    return {
      ipAddress,
      isMalicious: adjustedIsMalicious,
      isThreat,
      confidence,
      sources,
      categories: Array.from(allCategories),
      reason: this.generateReason(confidence, reasons, hasHighRiskCategory)
    };
  }

  /**
   * Generate human-readable reason for the threat assessment
   */
  private generateReason(
    confidence: number,
    reasons: string[],
    hasHighRiskCategory: boolean
  ): string {
    if (confidence === 0) {
      return 'No threats detected';
    }

    if (confidence >= this.autoBlacklistThreshold) {
      return `High threat confidence (${confidence}%)`;
    }

    if (hasHighRiskCategory) {
      return `High-risk activity detected`;
    }

    if (confidence >= this.minimumConfidence) {
      return `Moderate threat confidence (${confidence}%)`;
    }

    if (reasons.length > 0) {
      return reasons[0];
    }

    return `Low threat confidence (${confidence}%)`;
  }

  /**
   * Calculate risk level based on confidence and categories
   */
  calculateRiskLevel(confidence: number, categories: string[]): string {
    const hasHighRisk = categories.some(cat => 
      HIGH_RISK_CATEGORIES.some(highRisk => 
        cat.toLowerCase().includes(highRisk.toString())
      )
    );

    if (confidence >= 75 || hasHighRisk) {
      return 'critical';
    } else if (confidence >= 50) {
      return 'high';
    } else if (confidence >= 25) {
      return 'medium';
    } else if (confidence >= 10) {
      return 'low';
    }
    
    return 'minimal';
  }

  /**
   * Update scoring weights
   */
  updateWeights(weights: { [provider: string]: number }) {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      weights: this.weights,
      minimumConfidence: this.minimumConfidence,
      autoBlacklistThreshold: this.autoBlacklistThreshold
    };
  }
}