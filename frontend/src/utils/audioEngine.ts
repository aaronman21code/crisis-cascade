// frontend/src/utils/audioEngine.ts
// Cinematic war-room audio engine v3 — Web Audio API, no files, no dependencies.
// Layers: Shepard tone (buried in reverb) + granular texture + noise floor +
//         war drum cadence + tension string pad + metallic ghost.

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

// Gaussian bell on log-frequency scale for Shepard gain shaping
function shepardGain(freqHz: number): number {
  const logF = Math.log2(freqHz);
  const center = Math.log2(80);
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
  private shepardChorusOscs: OscillatorNode[] = [];
  private shepardChorusGains: GainNode[] = [];
  private shepardGainNode: GainNode | null = null;
  private shepardPhase = 0;
  private shepardTimer: ReturnType<typeof setInterval> | null = null;

  // Layer 2: Granular texture (always on)
  private granularInterval: ReturnType<typeof setInterval> | null = null;
  private granularLFOPhase = 0;

  // Layer 3: Noise floor (always on)
  private noiseGain: GainNode | null = null;

  // Layer 4: War drum cadence (λ ≥ 1.5)
  private drumGain: GainNode | null = null;
  private drumCycleTimeout: ReturnType<typeof setTimeout> | null = null;
  private drumActive = false;

  // Layer 5: Tension string pad (λ ≥ 2.0)
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // Layer 6: Metallic ghost (λ ≥ 2.5)
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
    this.drumActive = false;
    this.ghostActive = false;

    if (this.shepardTimer !== null) { clearInterval(this.shepardTimer); this.shepardTimer = null; }
    if (this.granularInterval !== null) { clearInterval(this.granularInterval); this.granularInterval = null; }
    if (this.tickInterval !== null) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.drumCycleTimeout !== null) { clearTimeout(this.drumCycleTimeout); this.drumCycleTimeout = null; }
    if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      [this.shepardGainNode, this.noiseGain, this.drumGain, this.padGain]
        .forEach(g => {
          if (g) { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 0.8); }
        });
      setTimeout(() => {
        [...this.shepardOscs, ...this.shepardChorusOscs, ...this.padOscs].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.shepardOscs = [];
        this.shepardGains = [];
        this.shepardChorusOscs = [];
        this.shepardChorusGains = [];
        this.padOscs = [];
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
    const RAMP = 3.0;

    // War drum: on at tension+
    if (this.drumGain) {
      const target = tier === 'calm' ? 0 : 1;
      this.drumGain.gain.cancelScheduledValues(now);
      this.drumGain.gain.linearRampToValueAtTime(target, now + RAMP);
      if (tier !== 'calm' && !this.drumActive) {
        this.drumActive = true;
        this._scheduleDrumCycle(ctx);
      } else if (tier === 'calm') {
        this.drumActive = false;
      }
    }

    // Tension pad: on at crisis+
    if (this.padGain) {
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.055 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Shepard: very slight boost at chaos
    if (this.shepardGainNode) {
      const target = tier === 'chaos' ? 0.022 : 0.016;
      this.shepardGainNode.gain.cancelScheduledValues(now);
      this.shepardGainNode.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Ghost: activate at chaos
    if (tier === 'chaos' && !this.ghostActive) {
      this.ghostActive = true;
      this._scheduleGhost(ctx);
    } else if (tier !== 'chaos') {
      this.ghostActive = false;
      if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }
    }

    this._restartTick(ctx);
  }

  // ── Layer construction ────────────────────────────────────────────────────

  private _buildLayers(ctx: AudioContext): void {

    // ── Layer 1: Shepard tone (buried in reverb, barely audible alone) ──
    this.shepardGainNode = ctx.createGain();
    this.shepardGainNode.gain.value = 0.016;

    const shepardReverb = this._makeReverb(ctx, 2.5);
    const shepardLPF = ctx.createBiquadFilter();
    shepardLPF.type = 'lowpass';
    shepardLPF.frequency.value = 400;
    // Signal path: oscs → reverb → LPF → shepardGainNode → master
    shepardReverb.connect(shepardLPF);
    shepardLPF.connect(this.shepardGainNode);
    this.shepardGainNode.connect(this.masterGain!);

    const BASE_FREQS = [40, 80, 160, 320, 640];
    this.shepardPhase = 0;

    BASE_FREQS.forEach((baseFreq, i) => {
      const phaseOffset = i / BASE_FREQS.length;
      const initFreq = baseFreq * Math.pow(2, phaseOffset);

      // Primary oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = initFreq;
      const gain = ctx.createGain();
      gain.gain.value = shepardGain(initFreq);
      osc.connect(gain);
      gain.connect(shepardReverb);
      osc.start();
      this.shepardOscs.push(osc);
      this.shepardGains.push(gain);

      // Chorus copy: slightly detuned (+0.5%)
      const chorus = ctx.createOscillator();
      chorus.type = 'sine';
      chorus.frequency.value = initFreq * 1.005;
      const chorusGain = ctx.createGain();
      chorusGain.gain.value = shepardGain(initFreq) * 0.5;
      chorus.connect(chorusGain);
      chorusGain.connect(shepardReverb);
      chorus.start();
      this.shepardChorusOscs.push(chorus);
      this.shepardChorusGains.push(chorusGain);
    });

    // Shepard animation — update every 80ms
    const PERIOD_MS = 45000;
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
        if (this.shepardChorusOscs[i]) this.shepardChorusOscs[i].frequency.value = freq * 1.005;
        if (this.shepardChorusGains[i]) this.shepardChorusGains[i].gain.value = g * 0.5;
      });
    }, 80);

    // ── Layer 2: Granular texture (always on) ──
    // Slow LFO drifts the grain frequency center between 180–280Hz
    this.granularLFOPhase = 0;
    const GRANULAR_PERIOD = 8000; // 8s drift cycle
    let lastGranTime = performance.now();

    this.granularInterval = setInterval(() => {
      if (!this.musicRunning || !this.ctx) return;
      const nowMs = performance.now();
      const dt = (nowMs - lastGranTime) / GRANULAR_PERIOD;
      lastGranTime = nowMs;
      this.granularLFOPhase = (this.granularLFOPhase + dt) % 1;

      const centerFreq = 180 + 100 * (0.5 + 0.5 * Math.sin(this.granularLFOPhase * 2 * Math.PI));
      const duration = 0.04 + Math.random() * 0.04; // 40–80ms grain

      const bufSize = Math.floor(this.ctx.sampleRate * duration);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = centerFreq;
      filter.Q.value = 4;

      const gain = this.ctx.createGain();
      const audioNow = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.022, audioNow);
      gain.gain.exponentialRampToValueAtTime(0.001, audioNow + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);
      src.start(audioNow);
      src.stop(audioNow + duration + 0.005);
    }, 90 + Math.random() * 20);

    // ── Layer 3: Noise floor (always on, brown noise) ──
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.018;

    const noiseLPF = ctx.createBiquadFilter();
    noiseLPF.type = 'lowpass';
    noiseLPF.frequency.value = 120;
    this.noiseGain.connect(noiseLPF);
    noiseLPF.connect(this.masterGain!);

    const noiseLen = Math.floor(ctx.sampleRate * 4);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    let lastVal = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      lastVal = (lastVal + 0.02 * white) / 1.02;
      nd[i] = lastVal * 3.5;
    }
    const noiseLoop = ctx.createBufferSource();
    noiseLoop.buffer = noiseBuf;
    noiseLoop.loop = true;
    noiseLoop.connect(this.noiseGain);
    noiseLoop.start();

    // ── Layer 4: War drum gain node (fades in at λ ≥ 1.5) ──
    this.drumGain = ctx.createGain();
    this.drumGain.gain.value = 0;
    this.drumGain.connect(this.masterGain!);

    // ── Layer 5: Tension string pad (fades in at λ ≥ 2.0) ──
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padReverb = this._makeReverb(ctx, 4.0);
    this.padGain.connect(padReverb);
    padReverb.connect(this.masterGain!);

    // Two clusters detuned ~2Hz apart — organic tremolo from beating
    const padFreqs = [58, 77, 103, 56, 75, 101];
    this.padOscs = padFreqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.padGain!);
      osc.start();
      return osc;
    });
  }

  // ── War drum pattern ──────────────────────────────────────────────────────
  // Pattern per 3200ms cycle: BOOM@0, tok@800, BOOM@1400, tok@1800, tok@2100

  private _scheduleDrumCycle(ctx: AudioContext): void {
    if (!this.drumActive || !this.musicRunning) return;

    const hits: Array<{ time: number; type: 'boom' | 'tok' }> = [
      { time: 0,    type: 'boom' },
      { time: 800,  type: 'tok'  },
      { time: 1400, type: 'boom' },
      { time: 1800, type: 'tok'  },
      { time: 2100, type: 'tok'  },
    ];

    hits.forEach(({ time, type }) => {
      setTimeout(() => {
        if (!this.drumActive || !this.ctx) return;
        if (type === 'boom') this._fireBoom(this.ctx);
        else this._fireTok(this.ctx);
      }, time);
    });

    // Schedule next cycle
    this.drumCycleTimeout = setTimeout(() => {
      this._scheduleDrumCycle(ctx);
    }, 3200);
  }

  private _fireBoom(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(52, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain);
    gain.connect(this.drumGain!);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  private _fireTok(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 185;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain!);
    src.start(now);
    src.stop(now + 0.085);
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

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
    filter.Q.value = 8;
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

  // ── Tick ──────────────────────────────────────────────────────────────────

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
    gain.gain.setValueAtTime(0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    src.start(now);
    src.stop(now + 0.022);
  }

  // ── Reverb ────────────────────────────────────────────────────────────────

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
