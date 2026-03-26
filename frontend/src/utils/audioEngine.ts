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
      const target = (tier === 'calm') ? 0 : 0.14;
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

    // Lowpass filter to cut harshness — only sub/low presence passes through
    const droneLPF = ctx.createBiquadFilter();
    droneLPF.type = 'lowpass';
    droneLPF.frequency.value = 160;
    droneLPF.Q.value = 0.7;
    this.droneGain.connect(droneLPF);
    droneLPF.connect(this.masterGain!);

    // Slow gain LFO for barely-perceptible breathing (0.04Hz = 25s cycle)
    const breathLFO = ctx.createOscillator();
    breathLFO.type = 'sine';
    breathLFO.frequency.value = 0.04;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.025;
    breathLFO.connect(breathDepth);
    breathDepth.connect(this.droneGain.gain);
    breathLFO.start();

    // 4 sine oscillators at spread frequencies — complex beating, never repeats
    const freqs = [36, 41, 55, 61];
    this.droneOscs = freqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
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
    // Band-passed noise burst — physical mechanical click feel, not a tone
    const bufSize = Math.floor(ctx.sampleRate * 0.02);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 140;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now);
    src.stop(now + 0.022);
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
    osc.frequency.value = 380;
    gain.gain.setValueAtTime(0.08, now);
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
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.25);
    gain.gain.setValueAtTime(0.055, now);
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
    subGain.gain.setValueAtTime(0.22, now);
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
    filter.frequency.value = 220;
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
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain);
      gain.connect(reverb);
      osc.start(now);
      osc.stop(now + 1.45);
    });
  }
}

export const audioEngine = new AudioEngine();
