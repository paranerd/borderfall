export interface GameAudio {
  play(conquest?: boolean): void;
  pause(): void;
}
export class BrowserAudio implements GameAudio {
  private context: AudioContext | null = null;
  play(conquest = false): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
      const osc = this.context.createOscillator(),
        gain = this.context.createGain();
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(conquest ? 440 : 220, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        conquest ? 660 : 160,
        this.context.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.06, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.18);
      osc.start();
      osc.stop(this.context.currentTime + 0.2);
    } catch {
      /* Sound is optional; gameplay remains available without an audio device. */
    }
  }
  pause(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }
}
