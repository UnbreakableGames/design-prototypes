export class Input {
  private keys = new Set<string>();
  private justDown = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  mouseJustDown = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justDown.add(e.code);
      this.keys.add(e.code);
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justDown.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) * canvas.width) / rect.width;
      this.mouseY = ((e.clientY - rect.top) * canvas.height) / rect.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this.mouseDown) this.mouseJustDown = true;
        this.mouseDown = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  held(code: string): boolean {
    return this.keys.has(code);
  }

  pressed(code: string): boolean {
    return this.justDown.has(code);
  }

  endFrame() {
    this.justDown.clear();
    this.mouseJustDown = false;
  }
}

const BLOCK_DEFAULT = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space',
]);
