export type Phase = 'day' | 'night' | 'dawn';

export const DAY_LENGTH = 80;
export const NIGHT_LENGTH = 40;
export const DAWN_LENGTH = 4;

export class Clock {
  phase: Phase = 'day';
  phaseTime = 0;
  night = 1;
  /** True when the clock wanted to leave `night` this tick but the caller
   *  blocked it (e.g. enemies still alive). UI reads this to show a
   *  "hold the line" indicator in place of the normal countdown. */
  heldAtPhaseEnd = false;

  /**
   * Advance the clock by `dt`. If `canAdvance` is supplied and returns
   * false at the moment a phase would roll over, the clock pins its
   * `phaseTime` to the full phase length without flipping phase — this
   * is how "dawn can't arrive until the night is cleared" is enforced.
   */
  update(dt: number, canAdvance?: (from: Phase) => boolean) {
    this.phaseTime += dt;
    const len = this.phaseLength();
    if (this.phaseTime >= len) {
      if (canAdvance && !canAdvance(this.phase)) {
        this.phaseTime = len;
        this.heldAtPhaseEnd = true;
        return;
      }
      this.phaseTime -= len;
      this.heldAtPhaseEnd = false;
      this.advance();
    } else {
      this.heldAtPhaseEnd = false;
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
