import type { GameEvent } from "./simulation";
/** Small synthesized cues: no audio files, downloads or autoplay before a gesture. */
export class GameFeedback {
  enabled = true;
  private context?: AudioContext;
  private cues = 0;
  metrics() {
    return {
      enabled: this.enabled,
      state: this.context?.state ?? "idle",
      cues: this.cues,
    };
  }
  private last = new Map<string, number>();
  constructor() {
    try {
      this.enabled = localStorage.getItem("tomori-feedback") !== "off";
    } catch {}
  }
  activate() {
    if (!this.enabled || typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Silent play stays available. */
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem("tomori-feedback", this.enabled ? "on" : "off");
    } catch {}
    if (this.enabled) this.activate();
  }
  private tone(
    frequency: number,
    duration: number,
    delay = 0,
    type: OscillatorType = "triangle",
    volume = 0.045,
  ) {
    const context = this.context;
    if (!context || context.state !== "running") return;
    this.cues++;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.65,
      at + duration,
    );
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  play(event: GameEvent) {
    if (!this.enabled) return;
    const key = event.type,
      now = performance.now();
    if (now - (this.last.get(key) ?? -1000) < (key === "pickup" ? 140 : 70))
      return;
    this.last.set(key, now);
    if (key === "shot") this.tone(180, 0.055, 0, "square", 0.023);
    else if (key === "hit") {
      this.tone(
        event.kind === "stone" ? 510 : event.kind === "enemy" ? 150 : 230,
        0.085,
        0,
        "triangle",
        0.06,
      );
    } else if (key === "pickup")
      this.tone(event.kind === "coin" ? 1150 : 810, 0.09);
    else if (key === "deposit") this.tone(360, 0.095, 0, "sine", 0.035);
    else if (key === "death")
      this.tone(event.kind === "enemy" ? 490 : 165, 0.17);
    else if (key === "complete" || key === "upgrade") {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.24, i * 0.085));
      if (
        typeof navigator.vibrate === "function" &&
        navigator.userActivation?.hasBeenActive
      )
        navigator.vibrate([15, 30, 15]);
    }
  }
}
