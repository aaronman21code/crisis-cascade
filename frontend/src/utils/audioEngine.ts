// frontend/src/utils/audioEngine.ts
// Cinematic war-room audio engine — Web Audio API, no files, no dependencies.
// Architecture: Shepard tone (Dunkirk illusion) + noise floor + sub pulse + tension pad + metallic ghost.

const STORAGE_KEY = 'cc_muted';

type LambdaTier = 'calm' | 'tension' | 'crisis' | 'chaos';

function getLambdaTier(lambda: number): LambdaTier {
  if (lambda >= 2.5) return 'chaos';
  if (lambda >= 2.0) return 'crisis';
  if (lambda >= 1.5) return 'tension';
  return 'calm';
}

function getTickInterval(tier: LambdaTier): number {
  if (tier === 'chaos')  return 333;
  if (tier === 'crisis') return 500;
  return 1000;
}

// Gaussian bell curve on log-frequency scale for Shepard tone gains
// Center at log2(80) ≈ 6.32; each octave step is 1 unit; sigma controls spread
function shepardGain(freqHz: number): number {
  const logF = Math.log2(freqHz);
  const center = Math.log2(80); // loudest around 80Hz
  const sigma = 1.8;
  return Math.exp(-0.5 * Math.pow((logF - center) / sigma, 2));
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private musicRunning = false;
  private currentTier: LambdaTier = 'calm';

  // Layer 1: Shepard tone
  private shepardOscs: OscillatorNode[] = [];
  private shepardGains: GainNode[] = [];
  private shepardGainNode: GainNode | null = null;
  private shepardPhase = 0; // 0–1, fraction through 45s octave cycle
  private shepardTimer: ReturnType<typeof setInterval> | null = null;

  // Layer 2: Noise floor
  private noiseGain: GainNode | null = null;

  // Layer 3: Sub pulse
  private subPulseGain: GainNode | null = null; // controls overall level (fades in/out with λ)
  private subPulseInterval: ReturnType<typeof setInterval> | null = null;

  // Layer 4: Tension pad
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padLFO: OscillatorNode | null = null;

  // Layer 5: Metallic ghost
  private ghostGain: GainNode | null = null;
  private ghostTimeout: ReturnType<typeof setTimeout> | null = null;
  private ghostActive = false;

  // Tick
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch { this.muted = false; }
    this.masterGain.gain.value = this.muted ? 0 : 1;
  }

  private ensureReady(): AudioContext | null {
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
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

  isMuted(): boolean { return this.muted; }

  // ── Music ─────────────────────────────────────────────────────────────────

  startMusic(): void {
    const ctx = this.ensureReady();
    if (!ctx || this.musicRunning) return;
    this.musicRunning = true;
    this.currentTier = 'calm';
    this._buildLayers(ctx);
    this._startTick(ctx);
  }

  stopMusic(): void {
    this.musicRunning = false;
    this.ghostActive = false;

    // Clear all intervals/timeouts
    [this.shepardTimer, this.subPulseInterval, this.tickInterval].forEach(id => {
      if (id !== null) clearInterval(id as ReturnType<typeof setInterval>);
    });
    this.shepardTimer = null;
    this.subPulseInterval = null;
    this.tickInterval = null;
    if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      [this.shepardGainNode, this.noiseGain, this.subPulseGain, this.padGain, this.ghostGain]
        .forEach(g => {
          if (g) { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 0.8); }
        });
      setTimeout(() => {
        [...this.shepardOscs, ...this.padOscs, this.padLFO].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.shepardOscs = [];
        this.shepardGains = [];
        this.padOscs = [];
        this.padLFO = null;
      }, 900);
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
    const RAMP = 3.0; // slow cinematic crossfade

    // Sub pulse: on at tension+
    if (this.subPulseGain) {
      const target = tier === 'calm' ? 0 : 1;
      this.subPulseGain.gain.cancelScheduledValues(now);
      this.subPulseGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Tension pad: on at crisis+
    if (this.padGain) {
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.06 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Shepard tone: slightly louder at chaos
    if (this.shepardGainNode) {
      const target = tier === 'chaos' ? 0.065 : 0.04;
      this.shepardGainNode.gain.cancelScheduledValues(now);
      this.shepardGainNode.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Metallic ghost: activate/deactivate
    if (tier === 'chaos' && !this.ghostActive) {
      this.ghostActive = true;
      this._scheduleGhost(ctx);
    } else if (tier !== 'chaos') {
      this.ghostActive = false;
      if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }
    }

    // Restart tick at new tempo
    this._restartTick(ctx);
  }

  // ── Layer construction ────────────────────────────────────────────────────

  private _buildLayers(ctx: AudioContext): void {
    // ── Layer 1: Shepard tone ──
    this.shepardGainNode = ctx.createGain();
    this.shepardGainNode.gain.value = 0.04;

    const shepardLPF = ctx.createBiquadFilter();
    shepardLPF.type = 'lowpass';
    shepardLPF.frequency.value = 400;
    this.shepardGainNode.connect(shepardLPF);
    shepardLPF.connect(this.masterGain!);

    // 5 oscillators at base octave-spaced frequencies
    // Each starts at a different phase so they don't all reset at once
    const BASE_FREQS = [40, 80, 160, 320, 640];
    this.shepardPhase = 0;

    BASE_FREQS.forEach((baseFreq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      // Stagger initial phases across the octave
      const phaseOffset = i / BASE_FREQS.length;
      const initFreq = baseFreq * Math.pow(2, phaseOffset);
      osc.frequency.value = initFreq;

      const gain = ctx.createGain();
      gain.gain.value = shepardGain(initFreq);
      osc.connect(gain);
      gain.connect(this.shepardGainNode!);
      osc.start();
      this.shepardOscs.push(osc);
      this.shepardGains.push(gain);
    });

    // Animate Shepard tone — update every 80ms
    const PERIOD_MS = 45000; // 45s per octave cycle
    let lastTime = performance.now();
    this.shepardTimer = setInterval(() => {
      if (!this.musicRunning) return;
      const now = performance.now();
      const dt = (now - lastTime) / PERIOD_MS;
      lastTime = now;
      this.shepardPhase = (this.shepardPhase + dt) % 1;

      BASE_FREQS.forEach((baseFreq, i) => {
        const phaseOffset = i / BASE_FREQS.length;
        const phase = (this.shepardPhase + phaseOffset) % 1;
        const freq = baseFreq * Math.pow(2, phase);
        const g = shepardGain(freq);
        if (this.shepardOscs[i]) this.shepardOscs[i].frequency.value = freq;
        if (this.shepardGains[i]) this.shepardGains[i].gain.value = g;
      });
    }, 80);

    // ── Layer 2: Noise floor ──
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.018;

    const noiseLPF = ctx.createBiquadFilter();
    noiseLPF.type = 'lowpass';
    noiseLPF.frequency.value = 120;
    this.noiseGain.connect(noiseLPF);
    noiseLPF.connect(this.masterGain!);

    // Loop a 4s noise buffer
    const noiseLen = Math.floor(ctx.sampleRate * 4);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    // Brown noise approximation — integrate white noise
    let lastVal = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      lastVal = (lastVal + 0.02 * white) / 1.02;
      nd[i] = lastVal * 3.5; // normalize
    }
    const noiseLoop = ctx.createBufferSource();
    noiseLoop.buffer = noiseBuf;
    noiseLoop.loop = true;
    noiseLoop.connect(this.noiseGain);
    noiseLoop.start();

    // Slow breath LFO on noise (0.02Hz = 50s cycle)
    const noiseLFO = ctx.createOscillator();
    noiseLFO.type = 'sine';
    noiseLFO.frequency.value = 0.02;
    const noiseLFOGain = ctx.createGain();
    noiseLFOGain.gain.value = 0.006;
    noiseLFO.connect(noiseLFOGain);
    noiseLFOGain.connect(this.noiseGain.gain);
    noiseLFO.start();

    // ── Layer 3: Sub pulse (starts silent, activates at λ ≥ 1.5) ──
    this.subPulseGain = ctx.createGain();
    this.subPulseGain.gain.value = 0; // starts off
    this.subPulseGain.connect(this.masterGain!);

    this.subPulseInterval = setInterval(() => {
      if (!this.musicRunning || !this.ctx) return;
      // Only fire if sub pulse is active (gain > 0)
      if (this.subPulseGain && this.subPulseGain.gain.value > 0.01) {
        this._fireSubPulse(this.ctx);
      }
    }, 3500);

    // ── Layer 4: Tension pad (starts silent, activates at λ ≥ 2.0) ──
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;

    const padReverb = this._makeReverb(ctx, 3.0);
    this.padGain.connect(padReverb);
    padReverb.connect(this.masterGain!);

    this.padLFO = ctx.createOscillator();
    this.padLFO.type = 'sine';
    this.padLFO.frequency.value = 0.06;
    const padLFOGain = ctx.createGain();
    padLFOGain.gain.value = 0.015;
    this.padLFO.connect(padLFOGain);
    padLFOGain.connect(this.padGain.gain);
    this.padLFO.start();

    const padFreqs = [55, 73, 98];
    this.padOscs = padFreqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.padGain!);
      osc.start();
      return osc;
    });

    // ── Layer 5: Ghost (starts silent, activates at λ ≥ 2.5) ──
    this.ghostGain = ctx.createGain();
    this.ghostGain.gain.value = 0;
    this.ghostGain.connect(this.masterGain!);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private _fireSubPulse(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 45;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.1);   // slow attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8); // long decay
    osc.connect(gain);
    gain.connect(this.subPulseGain!);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  private _scheduleGhost(ctx: AudioContext): void {
    if (!this.ghostActive) return;
    const delay = 4000 + Math.random() * 4000;
    this.ghostTimeout = setTimeout(() => {
      if (!this.ghostActive || !this.ctx) return;
      this._fireGhost(ctx);
      this._scheduleGhost(ctx);
    }, delay);
  }

  private _fireGhost(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 8; // very resonant — metallic ring

    const reverb = this._makeReverb(ctx, 1.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    src.connect(filter);
    filter.connect(reverb);
    reverb.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now);
    src.stop(now + 1.25);
  }

  private _startTick(ctx: AudioContext): void {
    this._fireTick(ctx);
    const ms = getTickInterval(this.currentTier);
    this.tickInterval = setInterval(() => {
      if (this.musicRunning) this._fireTick(ctx);
    }, ms);
  }

  private _restartTick(ctx: AudioContext): void {
    if (this.tickInterval !== null) { clearInterval(this.tickInterval); this.tickInterval = null; }
    this._startTick(ctx);
  }

  private _fireTick(ctx: AudioContext): void {
    const now = ctx.currentTime;
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
    gain.gain.setValueAtTime(0.012, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now);
    src.stop(now + 0.022);
  }

  private _makeReverb(ctx: AudioContext, duration: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
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
