/** Theo dõi phím đang giữ. Bỏ qua khi người chơi đang gõ trong ô nhập liệu. */
export class Keys {
  private down = new Set<string>();
  private pressedQueue: KeyboardEvent[] = [];
  private onDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (['Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1'].includes(e.key)) e.preventDefault();
    if (!e.repeat) this.pressedQueue.push(e);
    this.down.add(e.code);
  };
  private onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private onBlur = () => this.down.clear();

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Các lần nhấn phím mới kể từ lần gọi trước. */
  takePressed(): KeyboardEvent[] {
    const q = this.pressedQueue;
    this.pressedQueue = [];
    return q;
  }

  clear(): void {
    this.down.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}

export function isTyping(e?: Event): boolean {
  const el = (e?.target as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
