import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FloatingButton } from '../../src/widget/button';

describe('FloatingButton', () => {
  let floatingButton: FloatingButton;

  afterEach(() => {
    floatingButton?.destroy();
  });

  describe('Initialization', () => {
    it('should create button with default options', () => {
      floatingButton = new FloatingButton();
      
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      const button = Array.from(buttons).find(btn => btn.textContent === '🐛');
      expect(button).toBeDefined();
      expect(button?.getAttribute('aria-label')).toBe('Report Bug');
      expect(button?.getAttribute('data-bugspotter-exclude')).toBe('true');
    });

    it('should create button with custom icon', () => {
      floatingButton = new FloatingButton({ icon: '🚨' });
      
      const button = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent === '🚨'
      );
      expect(button).toBeDefined();
    });

    it('should create button with custom size', () => {
      floatingButton = new FloatingButton({ size: 80 });
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.width).toBe('80px');
      expect(button.style.height).toBe('80px');
    });

    it('should create button with custom background color', () => {
      floatingButton = new FloatingButton({ backgroundColor: '#3b82f6' });
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.backgroundColor).toContain('rgb(59, 130, 246)');
    });

    it('should position button bottom-right by default', () => {
      floatingButton = new FloatingButton();
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.bottom).toBe('20px');
      expect(button.style.right).toBe('20px');
    });

    it('should position button top-left when specified', () => {
      floatingButton = new FloatingButton({ position: 'top-left' });
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.top).toBe('20px');
      expect(button.style.left).toBe('20px');
    });

    it('should apply custom offset', () => {
      floatingButton = new FloatingButton({ 
        position: 'bottom-right',
        offset: { x: 50, y: 100 }
      });
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.bottom).toBe('100px');
      expect(button.style.right).toBe('50px');
    });

    it('should apply custom z-index', () => {
      floatingButton = new FloatingButton({ zIndex: 123456 });
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1];
      
      expect(button.style.zIndex).toBe('123456');
    });
  });

  describe('Event Handling', () => {
    it('should call onClick handler when button is clicked', () => {
      const handler = vi.fn();
      floatingButton = new FloatingButton();
      floatingButton.onClick(handler);
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      button.click();
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple click handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      floatingButton = new FloatingButton();
      floatingButton.onClick(handler1);
      floatingButton.onClick(handler2);
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      button.click();
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Methods', () => {
    beforeEach(() => {
      floatingButton = new FloatingButton();
    });

    it('should show button', () => {
      floatingButton.hide();
      floatingButton.show();
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      expect(button.style.display).toBe('flex');
    });

    it('should hide button', () => {
      floatingButton.hide();
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      expect(button.style.display).toBe('none');
    });

    it('should change icon', () => {
      floatingButton.setIcon('📝');
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      expect(button.textContent).toBe('📝');
    });

    it('should change background color', () => {
      floatingButton.setBackgroundColor('#10b981');
      
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      expect(button.style.backgroundColor).toContain('rgb(16, 185, 129)');
    });

    it('should remove button on destroy', () => {
      const initialButtonCount = document.querySelectorAll('button').length;
      
      floatingButton.destroy();
      
      const finalButtonCount = document.querySelectorAll('button').length;
      expect(finalButtonCount).toBe(initialButtonCount - 1);
    });
  });

  describe('Hover Effects', () => {
    beforeEach(() => {
      floatingButton = new FloatingButton();
    });

    it('should apply hover effects on mouseenter', () => {
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      button.dispatchEvent(new MouseEvent('mouseenter'));
      
      expect(button.style.transform).toBe('scale(1.1)');
    });

    it('should remove hover effects on mouseleave', () => {
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      button.dispatchEvent(new MouseEvent('mouseenter'));
      button.dispatchEvent(new MouseEvent('mouseleave'));
      
      expect(button.style.transform).toBe('scale(1)');
    });

    it('should scale down on mousedown', () => {
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      button.dispatchEvent(new MouseEvent('mousedown'));
      
      expect(button.style.transform).toBe('scale(0.95)');
    });

    it('should scale back up on mouseup', () => {
      const buttons = document.querySelectorAll('button');
      const button = buttons[buttons.length - 1] as HTMLButtonElement;
      
      button.dispatchEvent(new MouseEvent('mouseenter'));
      button.dispatchEvent(new MouseEvent('mousedown'));
      button.dispatchEvent(new MouseEvent('mouseup'));
      
      expect(button.style.transform).toBe('scale(1.1)');
    });
  });
});
