import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenshotCapture } from '../../src/capture/screenshot';
import * as htmlToImage from 'html-to-image';

vi.mock('html-to-image');

describe('ScreenshotCapture', () => {
  let screenshotCapture: ScreenshotCapture;

  beforeEach(() => {
    screenshotCapture = new ScreenshotCapture();
    vi.clearAllMocks();
  });

  it('should capture screenshot successfully', async () => {
    const mockDataUrl = 'data:image/png;base64,mockImageData';
    vi.mocked(htmlToImage.toPng).mockResolvedValue(mockDataUrl);

    const result = await screenshotCapture.capture();

    expect(result).toBe(mockDataUrl);
    expect(htmlToImage.toPng).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        quality: 0.8,
        cacheBust: true,
        backgroundColor: '#ffffff',
      })
    );
  });

  it('should use devicePixelRatio from window', async () => {
    const mockDataUrl = 'data:image/png;base64,mockImageData';
    vi.mocked(htmlToImage.toPng).mockResolvedValue(mockDataUrl);

    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      value: 2,
    });

    await screenshotCapture.capture();

    expect(htmlToImage.toPng).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        pixelRatio: 2,
      })
    );
  });

  it('should filter elements with data-bugspotter-exclude attribute', async () => {
    const mockDataUrl = 'data:image/png;base64,mockImageData';
    vi.mocked(htmlToImage.toPng).mockResolvedValue(mockDataUrl);

    await screenshotCapture.capture();

    const callArgs = vi.mocked(htmlToImage.toPng).mock.calls[0][1];
    const filterFn = callArgs?.filter;

    // Mock element with attribute
    const elementWithAttr = {
      hasAttribute: vi.fn().mockReturnValue(true),
    };

    // Mock element without attribute
    const elementWithoutAttr = {
      hasAttribute: vi.fn().mockReturnValue(false),
    };

    expect(filterFn?.(elementWithAttr as any)).toBe(false);
    expect(filterFn?.(elementWithoutAttr as any)).toBe(true);
  });

  it('should return SCREENSHOT_FAILED on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(htmlToImage.toPng).mockRejectedValue(new Error('Capture failed'));

    const result = await screenshotCapture.capture();

    expect(result).toBe('SCREENSHOT_FAILED');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[BugSpotter] ScreenshotCapture capturing screenshot:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should handle node without hasAttribute method', async () => {
    const mockDataUrl = 'data:image/png;base64,mockImageData';
    vi.mocked(htmlToImage.toPng).mockResolvedValue(mockDataUrl);

    await screenshotCapture.capture();

    const callArgs = vi.mocked(htmlToImage.toPng).mock.calls[0][1];
    const filterFn = callArgs?.filter;

    // Node without hasAttribute method
    const nodeWithoutMethod = {} as any;

    expect(filterFn?.(nodeWithoutMethod)).toBe(true);
  });
});
