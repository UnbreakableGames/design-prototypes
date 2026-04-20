export class FogOfWar {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const c = this.canvas.getContext('2d');
    if (!c) throw new Error('fog ctx unavailable');
    this.ctx = c;
    // Semi-transparent grey — terrain hints show through the mist.
    this.ctx.fillStyle = 'rgba(90, 96, 112, 0.72)';
    this.ctx.fillRect(0, 0, w, h);
  }

  reveal(x: number, y: number, radius: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.9)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  draw(
    destCtx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasW: number,
    canvasH: number,
  ) {
    // Blit the camera-visible slice of the world-sized fog canvas.
    destCtx.drawImage(
      this.canvas,
      cameraX, cameraY, canvasW, canvasH,
      0, 0, canvasW, canvasH,
    );
  }
}
