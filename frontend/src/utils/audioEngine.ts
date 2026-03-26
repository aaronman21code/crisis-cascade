// frontend/src/utils/audioEngine.ts
// Procedural audio engine — Web Audio API, no files, no dependencies.
// Hans Zimmer-style: ticking clock + drone layers that escalate with globalLambda.

const STORAGE_KEY = 'cc_muted';

type LambdaTier = 'calm' | 'tension' | 'crisis' | 'chaos';

function getLambdaTier(lambda: number): LambdaTier {
  if (lambda >= 2.5) return 'chaos';
  if (lambda >= 2.0) return 'crisis';
  if (lambda >= 1.5) return 'tension';
  return 'calm';
}

function getTickInterval(tier: LambdaTier): number {
  // ms between ticks
  if (tier === 'chaos')  return 333; // ~180 BPM
  if (tier === 'crisis') return 500; // ~120 BPM
  return 1000;                       // 60 BPM
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean = false;
  private musicRunning: boolean = false;
  private currentTier: LambdaTier = 'calm';

  // Tick
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // Drone layer (λ ≥ 1.5)
  private droneGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];

  // Tension pad (λ ≥ 2.0)
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private lfoOsc: OscillatorNode | null = null;

  // Chaos layer (λ ≥ 2.5)
  private chaosGain: GainNode | null = null;
  private chaosInterval: ReturnType<typeof setInterval> | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    if (this.ctx) return; // already initialized
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    // Load mute preference
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      this.muted = false;
    }
    this.masterGain.gain.value = this.muted ? 0 : 1;
  }

  private ensureReady(): AudioContext | null {
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // ── Mute ─────────────────────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this.muted = muted;
    try { localStorage.setItem(STORAGE_KEY, String(muted)); } catch {}
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.1);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ── Music ─────────────────────────────────────────────────────────────────

  startMusic(): void {
    const ctx = this.ensureReady();
    if (!ctx || this.musicRunning) return;
    this.musicRunning = true;
    this.currentTier = 'calm';
    this._startDroneLayers(ctx);
    this._startTick(ctx);
  }

  stopMusic(): void {
    this.musicRunning = false;

    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.chaosInterval !== null) {
      clearInterval(this.chaosInterval);
      this.chaosInterval = null;
    }

    // Fade out all layers
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      // Ramp drone/pad/chaos to 0 quickly
      [this.droneGain, this.padGain, this.chaosGain].forEach(g => {
        if (g) {
          g.gain.cancelScheduledValues(now);
          g.gain.linearRampToValueAtTime(0, now + 0.5);
        }
      });
      // Stop oscillators after fade
      setTimeout(() => {
        [...this.droneOscs, ...this.padOscs, this.lfoOsc].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.droneOscs = [];
        this.padOscs = [];
        this.lfoOsc = null;
      }, 600);
    }
  }

  updateLambda(lambda: number): void {
    if (!this.musicRunning) return;
    const ctx = this.ensureReady();
    if (!ctx) return;

    const tier = getLambdaTier(lambda);
    if (tier === this.currentTier) return;
    this.currentTier = tier;

    const now = ctx.currentTime;
    const RAMP = 2.0; // 2s crossfade

    // Drone: on at tension+
    if (this.droneGain) {
      const target = (tier === 'calm') ? 0 : 0.18;
      this.droneGain.gain.cancelScheduledValues(now);
      this.droneGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Pad: on at crisis+
    if (this.padGain) {
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.12 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Chaos: on at chaos
    if (this.chaosGain) {
      const target = tier === 'chaos' ? 0.09 : 0;
      this.chaosGain.gain.cancelScheduledValues(now);
      this.chaosGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Restart tick at new tempo
    this._restartTick(ctx);
  }

  // ── Internal: Drone layers ────────────────────────────────────────────────

  private _startDroneLayers(ctx: AudioContext): void {
    // Drone GainNode (starts silent, fades in when λ ≥ 1.5)
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.masterGain!);

    // Two detuned sawtooth oscillators for beating drone
    const freqs = [55, 57];
    this.droneOscs = freqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(this.droneGain!);
      osc.start();
      return osc;
    });

    // Tension pad GainNode
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;

    // Convolver reverb for pad (synthesized impulse response)
    const reverb = this._makeReverb(ctx, 2.5);
    this.padGain.connect(reverb);
    reverb.connect(this.masterGain!);

    // LFO for tremolo on pad
    this.lfoOsc = ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    this.lfoOsc.connect(lfoGain);
    lfoGain.connect(this.padGain.gain);
    this.lfoOsc.start();

    // Pad oscillators
    const padFreqs = [110, 146];
    this.padOscs = padFreqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(this.padGain!);
      osc.start();
      return osc;
    });

    // Chaos GainNode
    this.chaosGain = ctx.createGain();
    this.chaosGain.gain.value = 0;
    this.chaosGain.connect(this.masterGain!);
  }

  // ── Internal: Tick ────────────────────────────────────────────────────────

  private _startTick(ctx: AudioContext): void {
    this._fireTick(ctx);
    const ms = getTickInterval(this.currentTier);
    this.tickInterval = setInterval(() => {
      if (this.musicRunning) this._fireTick(ctx);
    }, ms);
  }

  private _restartTick(ctx: AudioContext): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this._startTick(ctx);
  }

  private _fireTick(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  // ── Internal: Reverb ─────────────────────────────────────────────────────

  private _makeReverb(ctx: AudioContext, duration: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  // ── Sound Effects ─────────────────────────────────────────────────────────

  playActionLock(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playPhaseTransition(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.25);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  playCascadeFire(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sub thump
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain!);
    subOsc.start(now);
    subOsc.stop(now + 0.55);

    // Noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.3);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noiseSource.start(now);
    noiseSource.stop(now + 0.32);
  }

  playLambdaThreshold(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const reverb = this._makeReverb(ctx, 1.5);
    reverb.connect(this.masterGain!);

    const freqs = [55, 73, 82];
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain);
      gain.connect(reverb);
      osc.start(now);
      osc.stop(now + 1.45);
    });
  }
}

export const audioEngine = new AudioEngine();
