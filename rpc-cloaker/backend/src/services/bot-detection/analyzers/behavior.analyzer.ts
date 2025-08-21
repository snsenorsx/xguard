/**
 * Behavior Analyzer
 * Analyzes user behavior patterns (placeholder for future implementation)
 */

import { AnalyzerResult, RequestContext } from '../types';

export class BehaviorAnalyzer {
  analyze(context: RequestContext): AnalyzerResult {
    const flags: string[] = [];
    let score = 0;

    // Check if behavior data is provided
    const behaviorData = context.fingerprint?.behavior;
    
    if (!behaviorData) {
      // No behavior data is neutral (not necessarily bot)
      return {
        score: 0,
        confidence: 0.5,
        flags: ['no_behavior_data'],
        details: { analyzed: false }
      };
    }

    // Mouse movement analysis
    if (behaviorData.mouse) {
      const mouseFlags = this.analyzeMouseBehavior(behaviorData.mouse);
      flags.push(...mouseFlags);
      if (mouseFlags.length > 0) {
        score = Math.max(score, 0.7);
      }
    }

    // Keyboard behavior analysis
    if (behaviorData.keyboard) {
      const keyboardFlags = this.analyzeKeyboardBehavior(behaviorData.keyboard);
      flags.push(...keyboardFlags);
      if (keyboardFlags.length > 0) {
        score = Math.max(score, 0.6);
      }
    }

    // Touch behavior analysis
    if (behaviorData.touch) {
      const touchFlags = this.analyzeTouchBehavior(behaviorData.touch);
      flags.push(...touchFlags);
      if (touchFlags.length > 0) {
        score = Math.max(score, 0.6);
      }
    }

    // Page interaction analysis
    if (behaviorData.interaction) {
      const interactionFlags = this.analyzeInteraction(behaviorData.interaction);
      flags.push(...interactionFlags);
      if (interactionFlags.length > 0) {
        score = Math.max(score, 0.8);
      }
    }

    return {
      score,
      confidence: this.calculateConfidence(flags, behaviorData),
      flags,
      details: {
        analyzed: true,
        hasMouseData: !!behaviorData.mouse,
        hasKeyboardData: !!behaviorData.keyboard,
        hasTouchData: !!behaviorData.touch,
        hasInteractionData: !!behaviorData.interaction
      }
    };
  }

  private analyzeMouseBehavior(mouseData: any): string[] {
    const flags: string[] = [];

    // Check for linear/robotic movements
    if (mouseData.movementPatterns?.linear > 0.8) {
      flags.push('linear_mouse_movement');
    }

    // Check for no mouse movement
    if (mouseData.totalMovements === 0) {
      flags.push('no_mouse_movement');
    }

    // Check for unrealistic speed
    if (mouseData.averageSpeed > 5000 || mouseData.averageSpeed < 10) {
      flags.push('unrealistic_mouse_speed');
    }

    // Check for perfect curves (bot indicator)
    if (mouseData.perfectCurves > 0.7) {
      flags.push('perfect_mouse_curves');
    }

    // Check for no acceleration/deceleration
    if (mouseData.constantVelocity > 0.8) {
      flags.push('constant_mouse_velocity');
    }

    return flags;
  }

  private analyzeKeyboardBehavior(keyboardData: any): string[] {
    const flags: string[] = [];

    // Check for inhuman typing speed
    if (keyboardData.averageTypingSpeed > 1000) { // chars per minute
      flags.push('superhuman_typing_speed');
    }

    // Check for no typing rhythm variation
    if (keyboardData.rhythmVariation < 0.1) {
      flags.push('no_typing_rhythm_variation');
    }

    // Check for copy-paste only behavior
    if (keyboardData.pasteRatio > 0.9) {
      flags.push('paste_only_behavior');
    }

    // Check for no typos/corrections
    if (keyboardData.correctionRate === 0 && keyboardData.totalKeystrokes > 50) {
      flags.push('no_typing_corrections');
    }

    return flags;
  }

  private analyzeTouchBehavior(touchData: any): string[] {
    const flags: string[] = [];

    // Check for no touch events on mobile
    if (touchData.isMobileDevice && touchData.totalTouches === 0) {
      flags.push('no_touch_on_mobile');
    }

    // Check for perfect touch precision
    if (touchData.touchPrecision > 0.95) {
      flags.push('perfect_touch_precision');
    }

    // Check for no multi-touch
    if (touchData.multiTouchRatio === 0 && touchData.totalTouches > 10) {
      flags.push('no_multitouch_gestures');
    }

    return flags;
  }

  private analyzeInteraction(interactionData: any): string[] {
    const flags: string[] = [];

    // Check for too fast page interactions
    if (interactionData.timeToFirstInteraction < 100) { // milliseconds
      flags.push('instant_page_interaction');
    }

    // Check for no scroll behavior
    if (interactionData.scrollEvents === 0 && interactionData.pageHeight > 2000) {
      flags.push('no_scroll_on_long_page');
    }

    // Check for no hover events
    if (interactionData.hoverEvents === 0) {
      flags.push('no_hover_events');
    }

    // Check for no focus/blur events
    if (interactionData.focusEvents === 0 && interactionData.formInteractions > 0) {
      flags.push('no_focus_events_with_forms');
    }

    // Check for perfect form completion time
    if (interactionData.formCompletionTime < 1000 && interactionData.formFields > 5) {
      flags.push('instant_form_completion');
    }

    return flags;
  }

  private calculateConfidence(flags: string[], behaviorData: any): number {
    // No behavior data means low confidence in the result
    if (!behaviorData || Object.keys(behaviorData).length === 0) {
      return 0.3;
    }

    // Higher confidence with more behavioral anomalies
    if (flags.some(f => f.includes('linear_mouse') || f.includes('perfect_'))) {
      return 0.9;
    }

    if (flags.includes('no_mouse_movement') && flags.includes('instant_page_interaction')) {
      return 0.85;
    }

    if (flags.length > 4) {
      return 0.8;
    }

    if (flags.length > 2) {
      return 0.7;
    }

    return 0.5 + (flags.length * 0.1);
  }
}