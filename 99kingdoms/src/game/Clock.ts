export type Phase = 'day' | 'night' | 'dawn';

export const DAY_LENGTH = 80;
export const NIGHT_LENGTH = 40;
export const DAWN_LENGTH = 4;

export class Clock {
  phase: Phase = 'day';
  phaseTime = 0;
  night = 1;

  update(dt: number) {
    this.phaseTime += dt;
    const len = this.phaseLength();
    if (this.phaseTime >= len) {
      this.phaseTime -= len;
      this.advance();
    }
  }

  phaseLength(): number {
    switch (this.phase) {
      case 'day': return DAY_LENGTH;
      case 'night': return NIGHT_LENGTH;
      case 'dawn': return DAWN_LENGTH;
    }
  }

  remaining(): number {
    return Math.max(0, this.phaseLength() - this.phaseTime);
  }

  progress(): number {
    return Math.min(1, this.phaseTime / this.phaseLength());
  }

  private advance() {
    if (this.phase === 'day') this.phase = 'night';
    else if (this.phase === 'night') this.phase = 'dawn';
    else {
      this.phase = 'day';
      this.night += 1;
    }
  }
}
