type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface FloatingButtonOptions {
  position?: ButtonPosition;
  icon?: string;
  backgroundColor?: string;
  size?: number;
  offset?: { x: number; y: number };
  zIndex?: number;
}

const DEFAULT_BUTTON_OPTIONS = {
  position: 'bottom-right' as const,
  icon: '🐛',
  backgroundColor: '#ef4444',
  size: 60,
  offset: { x: 20, y: 20 },
  zIndex: 999999,
} as const;

const BUTTON_STYLES = {
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  boxShadow: {
    default: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    hover: '0 10px 15px rgba(0, 0, 0, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  transform: {
    default: 'scale(1)',
    hover: 'scale(1.1)',
    active: 'scale(0.95)',
  },
} as const;

export class FloatingButton {
  private button: HTMLButtonElement;
  private options: Required<FloatingButtonOptions>;
  private eventHandlers = new Map<string, EventListener>();

  constructor(options: FloatingButtonOptions = {}) {
    this.options = {
      position: options.position ?? DEFAULT_BUTTON_OPTIONS.position,
      icon: options.icon ?? DEFAULT_BUTTON_OPTIONS.icon,
      backgroundColor: options.backgroundColor ?? DEFAULT_BUTTON_OPTIONS.backgroundColor,
      size: options.size ?? DEFAULT_BUTTON_OPTIONS.size,
      offset: options.offset ?? DEFAULT_BUTTON_OPTIONS.offset,
      zIndex: options.zIndex ?? DEFAULT_BUTTON_OPTIONS.zIndex,
    };

    this.button = this.createButton();

    // Ensure DOM is ready before appending
    if (document.body) {
      document.body.appendChild(this.button);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.button);
      });
    }
  }

  private createButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = this.options.icon;
    btn.setAttribute('aria-label', 'Report Bug');
    btn.setAttribute('data-bugspotter-exclude', 'true');
    btn.style.cssText = this.getButtonStyles();

    this.addHoverEffects(btn);

    return btn;
  }

  private getButtonStyles(): string {
    const { position, size, offset, backgroundColor, zIndex } = this.options;
    const positionStyles = this.getPositionStyles(position, offset);

    return `
      position: fixed;
      ${positionStyles}
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${backgroundColor};
      color: white;
      border: none;
      cursor: pointer;
      font-size: ${size * 0.5}px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${BUTTON_STYLES.boxShadow.default};
      transition: ${BUTTON_STYLES.transition};
      z-index: ${zIndex};
    `;
  }

  private getPositionStyles(position: ButtonPosition, offset: { x: number; y: number }): string {
    switch (position) {
      case 'bottom-right':
        return `bottom: ${offset.y}px; right: ${offset.x}px;`;
      case 'bottom-left':
        return `bottom: ${offset.y}px; left: ${offset.x}px;`;
      case 'top-right':
        return `top: ${offset.y}px; right: ${offset.x}px;`;
      case 'top-left':
        return `top: ${offset.y}px; left: ${offset.x}px;`;
      default:
        return `bottom: ${offset.y}px; right: ${offset.x}px;`;
    }
  }

  private handleMouseEnter = (): void => {
    this.button.style.transform = BUTTON_STYLES.transform.hover;
    this.button.style.boxShadow = BUTTON_STYLES.boxShadow.hover;
  };

  private handleMouseLeave = (): void => {
    this.button.style.transform = BUTTON_STYLES.transform.default;
    this.button.style.boxShadow = BUTTON_STYLES.boxShadow.default;
  };

  private handleMouseDown = (): void => {
    this.button.style.transform = BUTTON_STYLES.transform.active;
  };

  private handleMouseUp = (): void => {
    this.button.style.transform = BUTTON_STYLES.transform.hover;
  };

  private addHoverEffects(btn: HTMLButtonElement): void {
    const handlers: Record<string, EventListener> = {
      mouseenter: this.handleMouseEnter,
      mouseleave: this.handleMouseLeave,
      mousedown: this.handleMouseDown,
      mouseup: this.handleMouseUp,
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      btn.addEventListener(event, handler);
      this.eventHandlers.set(event, handler);
    });
  }

  onClick(handler: () => void): void {
    this.button.addEventListener('click', handler);
  }

  show(): void {
    this.button.style.display = 'flex';
  }

  hide(): void {
    this.button.style.display = 'none';
  }

  setIcon(icon: string): void {
    this.button.textContent = icon;
  }

  setBackgroundColor(color: string): void {
    this.button.style.backgroundColor = color;
  }

  destroy(): void {
    // Remove all event listeners
    this.eventHandlers.forEach((handler, event) => {
      this.button.removeEventListener(event, handler);
    });
    this.eventHandlers.clear();

    // Remove button from DOM
    this.button.remove();
  }
}
