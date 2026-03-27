// frontend/src/utils/audioEngine.ts
// Cinematic audio engine v5 — Sicario "The Beast" architecture.
// Slow heartbeat pulse, massive sub-bass, choir-like swells, industrial dread.
// Reference: Jóhann Jóhannsson — The Beast (Sicario OST)

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

function shepardGain(freqHz: number): number {
  const logF = Math.log2(freqHz);
  const center = Math.log2(60);
  const sigma = 1.6;
  return Math.exp(-0.5 * Math.pow((logF - center) / sigma, 2));
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private musicRunning = false;
  private currentTier: LambdaTier = 'calm';

  // Shepard (truly subliminal — presence only)
  private shepardOscs: OscillatorNode[] = [];
  private shepardGains: GainNode[] = [];
  private shepardGainNode: GainNode | null = null;
  private shepardPhase = 0;
  private shepardTimer: ReturnType<typeof setInterval> | null = null;

  // Sub rumble (always on — room floor)
  private rumbleGain: GainNode | null = null;

  // Choir swell pad (always on, swells with λ)
  private choirGain: GainNode | null = null;
  private choirOscs: OscillatorNode[] = [];

  // Heartbeat pulse (λ ≥ 1.5)
  private heartbeatGain: GainNode | null = null;
  private heartbeatActive = false;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  // Dark brass swell (fires with heartbeat at λ ≥ 1.5)
  private brassGain: GainNode | null = null;

  // Deep tension layer (λ ≥ 2.0)
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // Ghost resonance (λ ≥ 2.5)
  private ghostActive = false;
  private ghostTimeout: ReturnType<typeof setTimeout> | null = null;

  // Tick (barely audible)
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // ── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    try { this.muted = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { this.muted = false; }
    this.masterGain.gain.value = this.muted ? 0 : 1;
  }

  private ensureReady(): AudioContext | null {
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

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
    this.heartbeatActive = false;
    this.ghostActive = false;

    if (this.shepardTimer !== null) { clearInterval(this.shepardTimer); this.shepardTimer = null; }
    if (this.tickInterval !== null) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.heartbeatTimeout !== null) { clearTimeout(this.heartbeatTimeout); this.heartbeatTimeout = null; }
    if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      [this.shepardGainNode, this.rumbleGain, this.choirGain, this.heartbeatGain,
       this.brassGain, this.padGain].forEach(g => {
        if (g) { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 1.5); }
      });
      setTimeout(() => {
        [...this.shepardOscs, ...this.choirOscs, ...this.padOscs].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.shepardOscs = []; this.shepardGains = [];
        this.choirOscs = []; this.padOscs = [];
      }, 1600);
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
    const RAMP = 4.0; // slow, cinematic

    // Choir: present at all times, swells with tension
    if (this.choirGain) {
      const targets: Record<LambdaTier, number> = { calm: 0.025, tension: 0.055, crisis: 0.08, chaos: 0.1 };
      this.choirGain.gain.cancelScheduledValues(now);
      this.choirGain.gain.linearRampToValueAtTime(targets[tier], now + RAMP);
    }

    // Heartbeat: on at tension+
    if (this.heartbeatGain) {
      const target = tier === 'calm' ? 0 : 1;
      this.heartbeatGain.gain.cancelScheduledValues(now);
      this.heartbeatGain.gain.linearRampToValueAtTime(target, now + RAMP);
      if (tier !== 'calm' && !this.heartbeatActive) {
        this.heartbeatActive = true;
        this._scheduleHeartbeat(ctx);
      } else if (tier === 'calm') {
        this.heartbeatActive = false;
      }
    }

    // Deep pad: on at crisis+
    if (this.padGain) {
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.065 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Shepard: stays subliminal
    if (this.shepardGainNode) {
      const target = tier === 'chaos' ? 0.006 : 0.003;
      this.shepardGainNode.gain.cancelScheduledValues(now);
      this.shepardGainNode.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Ghost
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

    // ── Shepard (subliminal, 0.003 gain, heavy reverb) ──
    this.shepardGainNode = ctx.createGain();
    this.shepardGainNode.gain.value = 0.003;
    const shepReverb = this._makeReverb(ctx, 4.0);
    const shepLPF = ctx.createBiquadFilter();
    shepLPF.type = 'lowpass'; shepLPF.frequency.value = 250;
    shepReverb.connect(shepLPF); shepLPF.connect(this.shepardGainNode);
    this.shepardGainNode.connect(this.masterGain!);

    const BASE_FREQS = [35, 70, 140, 280, 560];
    this.shepardPhase = 0;
    BASE_FREQS.forEach((baseFreq, i) => {
      const phaseOffset = i / BASE_FREQS.length;
      const initFreq = baseFreq * Math.pow(2, phaseOffset);
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = initFreq;
      const gain = ctx.createGain();
      gain.gain.value = shepardGain(initFreq);
      osc.connect(gain); gain.connect(shepReverb); osc.start();
      this.shepardOscs.push(osc); this.shepardGains.push(gain);
    });

    const PERIOD_MS = 60000; // slower — 60s octave cycle
    let lastTime = performance.now();
    this.shepardTimer = setInterval(() => {
      if (!this.musicRunning) return;
      const now = performance.now();
      const dt = (now - lastTime) / PERIOD_MS;
      lastTime = now;
      this.shepardPhase = (this.shepardPhase + dt) % 1;
      BASE_FREQS.forEach((baseFreq, i) => {
        const phase = (this.shepardPhase + i / BASE_FREQS.length) % 1;
        const freq = baseFreq * Math.pow(2, phase);
        const g = shepardGain(freq);
        if (this.shepardOscs[i]) this.shepardOscs[i].frequency.value = freq;
        if (this.shepardGains[i]) this.shepardGains[i].gain.value = g;
      });
    }, 120);

    // ── Sub rumble (always on — floor presence) ──
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.014;
    const rumbleLPF = ctx.createBiquadFilter();
    rumbleLPF.type = 'lowpass'; rumbleLPF.frequency.value = 80;
    this.rumbleGain.connect(rumbleLPF); rumbleLPF.connect(this.masterGain!);

    const rLen = Math.floor(ctx.sampleRate * 6);
    const rBuf = ctx.createBuffer(1, rLen, ctx.sampleRate);
    const rd = rBuf.getChannelData(0);
    let rv = 0;
    for (let i = 0; i < rLen; i++) {
      rv = (rv + 0.015 * (Math.random() * 2 - 1)) / 1.015;
      rd[i] = rv * 4;
    }
    const rLoop = ctx.createBufferSource();
    rLoop.buffer = rBuf; rLoop.loop = true;
    rLoop.connect(this.rumbleGain); rLoop.start();

    // ── Choir swell (always on, builds with λ) ──
    // Multiple detuned sine oscillators with very slow attack character.
    // Simulates the choir-like quality of Sicario's string/brass ensemble.
    this.choirGain = ctx.createGain();
    this.choirGain.gain.value = 0.025; // starts quiet at calm

    const choirReverb = this._makeReverb(ctx, 5.0); // long hall reverb
    const choirLPF = ctx.createBiquadFilter();
    choirLPF.type = 'lowpass'; choirLPF.frequency.value = 350;
    this.choirGain.connect(choirReverb);
    choirReverb.connect(choirLPF);
    choirLPF.connect(this.masterGain!);

    // 8 oscillators spread across two octave-spaced groups, all slightly detuned
    // Creates that dense, warm cluster of voices
    const choirFreqs = [
      // Lower group (cello/bass register)
      62, 65, 68, 73,
      // Upper group (viola register) — exactly one octave up + slight detuning
      124, 129, 136, 146,
    ];
    this.choirOscs = choirFreqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; // warmer than sine, not buzzy
      osc.frequency.value = freq;
      osc.connect(this.choirGain!);
      osc.start();
      return osc;
    });

    // Very slow breath on choir (0.03Hz = 33s cycle)
    const choirBreath = ctx.createOscillator();
    choirBreath.type = 'sine';
    choirBreath.frequency.value = 0.03;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.008;
    choirBreath.connect(breathDepth);
    breathDepth.connect(this.choirGain.gain);
    choirBreath.start();

    // ── Heartbeat bus (fades in at λ ≥ 1.5) ──
    // Large room reverb — the heartbeat reverberates through a massive space
    this.heartbeatGain = ctx.createGain();
    this.heartbeatGain.gain.value = 0;
    const hbReverb = this._makeReverb(ctx, 2.5);
    this.heartbeatGain.connect(hbReverb);
    hbReverb.connect(this.masterGain!);
    // Also dry signal for punch
    this.heartbeatGain.connect(this.masterGain!);

    // ── Brass swell bus (fires with heartbeat) ──
    this.brassGain = ctx.createGain();
    this.brassGain.gain.value = 1;
    const brassReverb = this._makeReverb(ctx, 3.5);
    const brassLPF = ctx.createBiquadFilter();
    brassLPF.type = 'lowpass'; brassLPF.frequency.value = 300;
    this.brassGain.connect(brassReverb);
    brassReverb.connect(brassLPF);
    brassLPF.connect(this.masterGain!);

    // ── Deep pad (λ ≥ 2.0) ──
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padReverb = this._makeReverb(ctx, 5.0);
    this.padGain.connect(padReverb); padReverb.connect(this.masterGain!);
    // Very deep minor cluster
    [44, 52, 58, 69, 77].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      osc.connect(this.padGain!); osc.start();
      this.padOscs.push(osc);
    });
  }

  // ── Heartbeat pattern ─────────────────────────────────────────────────────
  // lub-DUB heartbeat: heavy BOOM at 0ms, lighter boom at 220ms
  // Cycle: ~1600ms (~38 BPM) — slow, oppressive

  private _scheduleHeartbeat(ctx: AudioContext): void {
    if (!this.heartbeatActive || !this.musicRunning) return;

    // lub (heavy)
    this._fireLub(ctx);
    // DUB (softer, 220ms later)
    setTimeout(() => {
      if (!this.heartbeatActive || !this.ctx) return;
      this._fireDub(this.ctx);
      // Brass swell with every lub-DUB
      this._fireBrassSwell(this.ctx);
    }, 220);

    this.heartbeatTimeout = setTimeout(() => this._scheduleHeartbeat(ctx), 1600);
  }

  // Heavy lub: sub-bass sine, pitch drop, massive attack
  private _fireLub(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(48, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.5);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(gain); gain.connect(this.heartbeatGain!);
    osc.start(now); osc.stop(now + 0.7);
  }

  // Softer dub: same shape but quieter and slightly higher
  private _fireDub(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(38, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain); gain.connect(this.heartbeatGain!);
    osc.start(now); osc.stop(now + 0.55);
  }

  // Slow low brass swell — trombone cluster, very slow attack, 2.5s decay
  private _fireBrassSwell(ctx: AudioContext): void {
    if (!this.heartbeatActive) return;
    const now = ctx.currentTime;
    // Minor cluster: root, flat 3rd, 5th — dark, heavy
    const brFreqs = [44, 52, 66, 88];
    brFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const pk = i === 0 ? 0.065 : 0.045;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(pk, now + 0.18); // slow brass attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(gain); gain.connect(this.brassGain!);
      osc.start(now); osc.stop(now + 2.6);
    });
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

  private _scheduleGhost(ctx: AudioContext): void {
    if (!this.ghostActive) return;
    this.ghostTimeout = setTimeout(() => {
      if (!this.ghostActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 1.5);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 280; filter.Q.value = 10;
      const reverb = this._makeReverb(this.ctx, 2.0);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      src.connect(filter); filter.connect(reverb);
      reverb.connect(gain); gain.connect(this.masterGain!);
      src.start(now); src.stop(now + 1.55);
      this._scheduleGhost(ctx);
    }, 5000 + Math.random() * 5000);
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  private _startTick(ctx: AudioContext): void {
    this._fireTick(ctx);
    this.tickInterval = setInterval(() => {
      if (this.musicRunning) this._fireTick(ctx);
    }, getTickInterval(this.currentTier));
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
    filter.type = 'bandpass'; filter.frequency.value = 120; filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.007, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain!);
    src.start(now); src.stop(now + 0.022);
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
    osc.type = 'sine'; osc.frequency.value = 320;
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(now); osc.stop(now + 0.1);
  }

  playPhaseTransition(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.3);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(now); osc.stop(now + 0.55);
  }

  playCascadeFire(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep sub impact
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(65, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    subG.gain.setValueAtTime(0.22, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    sub.connect(subG); subG.connect(this.masterGain!);
    sub.start(now); sub.stop(now + 0.6);

    // Low rumble burst
    const bufSize = Math.floor(ctx.sampleRate * 0.4);
    const nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = nBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 180;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.1, now);
    nG.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    src.connect(filter); filter.connect(nG); nG.connect(this.masterGain!);
    src.start(now); src.stop(now + 0.42);
  }

  playLambdaThreshold(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const reverb = this._makeReverb(ctx, 2.5);
    reverb.connect(this.masterGain!);
    [44, 55, 66].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc.connect(gain); gain.connect(reverb);
      osc.start(now); osc.stop(now + 1.85);
    });
  }
}

export const audioEngine = new AudioEngine();
