# Bug Report Modal - PII Detection & Manual Redaction

## Overview

The BugReportModal now includes PII detection preview and manual screenshot redaction capabilities, allowing users to verify and manually redact any sensitive data before submitting bug reports.

## ✨ New Features

### 1. **PII Detection Display**
- Shows detected sensitive data types and counts
- Visual indicators for: emails, phones, credit cards, SSNs, IPs, etc.
- Warns users when sensitive data is detected

### 2. **Manual Redaction Tool**
- Draw black rectangles over sensitive areas in screenshots
- Interactive canvas overlay for precise redaction
- Clear button to remove all redactions
- Live preview of redacted areas

### 3. **PII Confirmation Checkbox**
- Required confirmation when PII is detected
- Prevents accidental submission of sensitive data
- User must explicitly confirm no sensitive data remains

## 🎨 UI Components

### PII Detection Section
```
┌──────────────────────────────────────┐
│ Detected Sensitive Data              │
├──────────────────────────────────────┤
│ [3 emails] [2 phones] [1 ip]         │
│                                      │
│ [🖍️ Redact Areas] [🗑️ Clear]        │
│                                      │
│ ☐ I confirm no sensitive data       │
│   remains visible                    │
└──────────────────────────────────────┘
```

### Redaction Canvas
- Transparent overlay on screenshot
- Crosshair cursor when active
- Draw black rectangles by click-and-drag
- Real-time visual feedback

## 📝 Usage

### Basic Usage

```typescript
import { BugReportModal, PIIDetection } from '@bugspotter/sdk';

const modal = new BugReportModal({
  onSubmit: async (data) => {
    // Submit bug report
  }
});

// Show with PII detections
const piiDetections: PIIDetection[] = [
  { type: 'email', count: 3 },
  { type: 'phone', count: 2 },
  { type: 'ip', count: 1 }
];

modal.show(screenshot, piiDetections);
```

### Integration with Sanitizer

```typescript
import { BugSpotter, Sanitizer, createSanitizer } from '@bugspotter/sdk';

// Create sanitizer
const sanitizer = createSanitizer({
  enabled: true,
  patterns: 'all'
});

// Analyze bug report data for PII
const bugReport = await BugSpotter.getInstance()?.capture();

// Count PII detections
const piiDetections = analyzePIIInReport(bugReport, sanitizer);

// Show modal with detections
modal.show(bugReport.screenshot, piiDetections);
```

## 🔧 API Reference

### PIIDetection Interface

```typescript
interface PIIDetection {
  /** PII type (e.g., 'email', 'phone', 'creditcard') */
  type: string;
  
  /** Number of instances detected */
  count: number;
}
```

### BugReportModal.show() Method

```typescript
/**
 * Show the modal with screenshot and optional PII detections
 * @param screenshot - Base64 encoded screenshot
 * @param piiDetections - Optional array of detected PII types
 */
show(screenshot: string, piiDetections?: PIIDetection[]): void
```

### New Private Methods

```typescript
// Display PII detection badges
private showPIIDetections(detections: PIIDetection[]): void

// Initialize canvas overlay on screenshot
private initRedactionCanvas(): void

// Toggle redaction drawing mode
private toggleRedactionMode(): void

// Attach mouse event listeners for drawing
private attachRedactionListeners(): void

// Remove mouse event listeners
private removeRedactionListeners(): void

// Handle drawing start
private handleRedactionStart(e: MouseEvent): void

// Handle drawing movement
private handleRedactionMove(e: MouseEvent): void

// Handle drawing end
private handleRedactionEnd(e: MouseEvent): void

// Redraw all redaction rectangles
private redrawRedactions(): void

// Clear all redaction rectangles
private clearRedactions(): void

// Get final screenshot with redactions applied
private getRedactedScreenshot(): string
```

## 🎯 User Workflow

1. **Bug Report Triggered**
   - User clicks bug report button
   - Screenshot is captured
   - PII detection runs on captured data

2. **Modal Opens**
   - Screenshot is displayed
   - PII detections shown (if any found)
   - Redaction tools are available

3. **User Reviews**
   - Reviews detected PII items
   - Identifies any additional sensitive areas

4. **Manual Redaction (Optional)**
   - Clicks "Redact Areas" button
   - Draws black rectangles over sensitive data
   - Can clear and redraw as needed

5. **Confirmation**
   - If PII detected, must check confirmation box
   - Fills in title and description

6. **Submit**
   - Validation requires PII confirmation (if applicable)
   - Redacted screenshot is included in submission

## 🎨 Styling

### Colors & Themes

- **PII Warning**: Yellow background (`#fef3c7`)
- **PII Badges**: Red background (`#fee2e2`)
- **Redaction Tool Active**: Red (`#ef4444`)
- **Redaction Overlay**: Black with 80% opacity

### CSS Classes

```css
.pii-detection       /* Main PII section container */
.pii-list            /* List of detected PII types */
.pii-item            /* Individual PII badge */
.pii-info            /* "No PII detected" message */
.redaction-tools     /* Button container */
.tool-btn            /* Redaction tool button */
.tool-btn.active     /* Active redaction mode */
.checkbox            /* Confirmation checkbox */
.screenshot-wrapper  /* Screenshot + canvas container */
#redaction-canvas    /* Canvas overlay element */
```

## 🔒 Security Benefits

### Prevents Accidental Data Leaks
- **Visual Warning**: Users see exactly what PII is detected
- **Manual Control**: Users can redact any additional sensitive areas
- **Forced Confirmation**: Cannot submit with PII unless explicitly confirmed

### Layered Protection
1. **Automatic Sanitization**: Text-based PII in logs, network data, etc.
2. **PII Detection Display**: Visual feedback about detected sensitive data
3. **Manual Redaction**: User-controlled screenshot redaction
4. **Confirmation Gate**: Explicit user acknowledgment required

## 📊 Example Scenarios

### Scenario 1: Email Addresses in Screenshot
```typescript
// PII detected in screenshot showing inbox
const piiDetections = [
  { type: 'email', count: 5 }
];

modal.show(screenshot, piiDetections);

// User sees: "5 emails" badge
// User activates redaction tool
// User draws black boxes over email addresses
// User checks confirmation
// Submits with redacted screenshot
```

### Scenario 2: No PII Detected
```typescript
// Clean screenshot
modal.show(screenshot, []);

// User sees: "No sensitive data detected"
// Checkbox not required
// Can submit immediately
```

### Scenario 3: Multiple PII Types
```typescript
const piiDetections = [
  { type: 'email', count: 2 },
  { type: 'phone', count: 1 },
  { type: 'creditcard', count: 1 },
  { type: 'ip', count: 3 }
];

modal.show(screenshot, piiDetections);

// User sees: "2 emails", "1 phone", "1 creditcard", "3 ips"
// User carefully reviews screenshot
// Redacts sensitive areas
// Confirms and submits
```

## 🧪 Testing

All existing tests pass (226/226) with the new features:
- ✅ Modal initialization
- ✅ Form validation
- ✅ Submit handling
- ✅ Cleanup and destroy
- ✅ Backward compatibility (optional piiDetections parameter)

### Test Coverage

```typescript
// Modal shows without PII detections (backward compatible)
modal.show(screenshot);

// Modal shows with PII detections
modal.show(screenshot, [
  { type: 'email', count: 2 }
]);

// Redaction canvas initialized on image load
// Redaction tools can be activated/deactivated
// Redaction rectangles can be drawn
// Redactions can be cleared
// Final screenshot includes redactions
```

## 🚀 Future Enhancements

### Possible Additions
1. **Auto-detect PII in Screenshots**: OCR-based text detection in images
2. **Smart Redaction Suggestions**: Highlight areas with likely PII
3. **Blur Instead of Black**: Option for blur instead of solid rectangles
4. **Undo/Redo**: Redaction history with undo capability
5. **Export Redaction Patterns**: Save and reuse redaction zones
6. **Multi-select Redactions**: Delete specific redaction rectangles

## 📖 Related Documentation

- [PII Sanitization Guide](./PII_SANITIZATION.md) - Text-based PII detection
- [Pattern Configuration](./PATTERN_CONFIGURATION.md) - Customizing PII patterns
- [Sanitizer Refactoring](./SANITIZER_REFACTORING.md) - Architecture details

---

**Version:** 1.0  
**Last Updated:** October 5, 2025  
**Status:** ✅ Fully Implemented & Tested
