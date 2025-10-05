/**
 * PIIDetectionDisplay
 * 
 * Responsibility: Render PII detection UI and manage PII-related display logic
 * Follows SRP: Only handles PII visualization
 */

import type { PIIDetection } from '../modal';

export interface PIIDisplayConfig {
  showExamples?: boolean;
  groupByType?: boolean;
  maxExamplesPerType?: number;
}

export class PIIDetectionDisplay {
  private config: Required<PIIDisplayConfig>;

  constructor(config: PIIDisplayConfig = {}) {
    this.config = {
      showExamples: config.showExamples !== false,
      groupByType: config.groupByType !== false,
      maxExamplesPerType: config.maxExamplesPerType || 3,
    };
  }

  /**
   * Render PII detection information into a container
   */
  render(piiDetections: PIIDetection[], container: HTMLElement): void {
    if (!piiDetections || piiDetections.length === 0) {
      container.innerHTML = '';
      return;
    }

    if (this.config.groupByType) {
      container.innerHTML = this.renderGroupedPII(piiDetections);
    } else {
      container.innerHTML = this.renderListPII(piiDetections);
    }
  }

  /**
   * Render PII grouped by type with badges
   */
  private renderGroupedPII(piiDetections: PIIDetection[]): string {
    const grouped = this.groupByType(piiDetections);
    const badges: string[] = [];

    for (const [type, items] of Object.entries(grouped)) {
      const totalCount = items.reduce((sum, item) => sum + item.count, 0);
      badges.push(this.createBadge(type, totalCount));
    }

    let html = `<div class="bugspotter-pii-badges">${badges.join('')}</div>`;

    if (this.config.showExamples) {
      html += '<div class="bugspotter-pii-details">';
      html += '<p style="margin: 10px 0 5px 0; font-size: 13px; color: #856404;">Detected types:</p>';
      html += '<ul class="bugspotter-pii-list">';
      
      for (const [type, items] of Object.entries(grouped)) {
        const totalCount = items.reduce((sum, item) => sum + item.count, 0);
        html += `<li><strong>${this.escapeHtml(type)}:</strong> ${totalCount} occurrence${totalCount !== 1 ? 's' : ''}</li>`;
      }
      
      html += '</ul></div>';
    }

    return html;
  }

  /**
   * Render PII as a simple list
   */
  private renderListPII(piiDetections: PIIDetection[]): string {
    let html = '<ul class="bugspotter-pii-list">';
    
    for (const detection of piiDetections) {
      html += `<li>${this.escapeHtml(detection.type)}: ${detection.count} occurrence${detection.count !== 1 ? 's' : ''}</li>`;
    }
    
    html += '</ul>';
    return html;
  }

  /**
   * Create a PII type badge
   */
  private createBadge(type: string, count: number): string {
    return `<span class="bugspotter-pii-badge">${this.escapeHtml(type)}: ${count}</span>`;
  }

  /**
   * Group PII detections by type
   */
  private groupByType(piiDetections: PIIDetection[]): Record<string, PIIDetection[]> {
    const grouped: Record<string, PIIDetection[]> = {};

    for (const detection of piiDetections) {
      if (!grouped[detection.type]) {
        grouped[detection.type] = [];
      }
      grouped[detection.type].push(detection);
    }

    return grouped;
  }

  /**
   * Get summary statistics about PII detections
   */
  getSummary(piiDetections: PIIDetection[]): {
    totalCount: number;
    typeCount: number;
    types: string[];
  } {
    const types = new Set<string>();
    
    for (const detection of piiDetections) {
      types.add(detection.type);
    }

    return {
      totalCount: piiDetections.length,
      typeCount: types.size,
      types: Array.from(types),
    };
  }

  /**
   * Check if PII detections contain a specific type
   */
  hasType(piiDetections: PIIDetection[], type: string): boolean {
    return piiDetections.some(d => d.type === type);
  }

  /**
   * Filter PII detections by type
   */
  filterByType(piiDetections: PIIDetection[], type: string): PIIDetection[] {
    return piiDetections.filter(d => d.type === type);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PIIDisplayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<PIIDisplayConfig> {
    return { ...this.config };
  }
}
