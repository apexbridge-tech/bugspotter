import { toPng } from 'html-to-image';

export class ScreenshotCapture {
  async capture(): Promise<string> {
    try {
      const dataUrl = await toPng(document.body, {
        quality: 0.8,
        cacheBust: true,
        pixelRatio: window.devicePixelRatio,
        backgroundColor: '#ffffff',
        filter: (node) => {
          // Exclude elements with data-exclude attribute
          return !node.hasAttribute?.('data-bugspotter-exclude');
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return 'SCREENSHOT_FAILED';
    }
  }
}
