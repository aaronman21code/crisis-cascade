// frontend/src/utils/audioEngine.ts
// Cinematic war-room audio engine v4 — Web Audio API, no files, no dependencies.
// Hans Zimmer war/drama architecture:
//   - War drums (front, prominent, reverberant)
//   - Brass pulse (fires with every BOOM — low detuned sawtooth chord)
//   - Cello tremolo section (fast-amplitude bowed strings texture, always present)
//   - Noise floor (room presence)
//   - Shepard tone (subliminal — barely audible, psychological only)
//   - Metallic ghost (chaos layer)

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

  // Shepard (subliminal only)
  private shepardOscs: OscillatorNode[] = [];
  private shepardGains: GainNode[] = [];
  private shepardChorusOscs: OscillatorNode[] = [];
  private shepardChorusGains: GainNode[] = [];
  private shepardGainNode: GainNode | null = null;
  private shepardPhase = 0;
  private shepardTimer: ReturnType<typeof setInterval> | null = null;

  // Noise floor
  private noiseGain: GainNode | null = null;

  // Cello tremolo section (always on, low volume at calm, builds with λ)
  private celloGain: GainNode | null = null;
  private celloOscs: OscillatorNode[] = [];
  private celloTremoloLFO: OscillatorNode | null = null;

  // War drums (λ ≥ 1.5)
  private drumGain: GainNode | null = null;
  private drumReverb: ConvolverNode | null = null;
  private drumCycleTimeout: ReturnType<typeof setTimeout> | null = null;
  private drumActive = false;

  // Brass pulse (fires with BOOM)
  private brassGain: GainNode | null = null;

  // Tension pad (λ ≥ 2.0)
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // Ghost (λ ≥ 2.5)
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
    if (this.tickInterval !== null) { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.drumCycleTimeout !== null) { clearTimeout(this.drumCycleTimeout); this.drumCycleTimeout = null; }
    if (this.ghostTimeout !== null) { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      [this.shepardGainNode, this.noiseGain, this.celloGain, this.drumGain, this.brassGain, this.padGain]
        .forEach(g => {
          if (g) { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 1.0); }
        });
      setTimeout(() => {
        [...this.shepardOscs, ...this.shepardChorusOscs, ...this.celloOscs, ...this.padOscs,
         this.celloTremoloLFO].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.shepardOscs = []; this.shepardGains = [];
        this.shepardChorusOscs = []; this.shepardChorusGains = [];
        this.celloOscs = []; this.padOscs = [];
        this.celloTremoloLFO = null;
      }, 1100);
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

    // Cello: always on but gets louder with tension
    if (this.celloGain) {
      const targets: Record<LambdaTier, number> = { calm: 0.03, tension: 0.055, crisis: 0.075, chaos: 0.09 };
      this.celloGain.gain.cancelScheduledValues(now);
      this.celloGain.gain.linearRampToValueAtTime(targets[tier], now + RAMP);
    }

    // Drums: on at tension+
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
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.06 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Shepard: stays subliminal always
    if (this.shepardGainNode) {
      const target = tier === 'chaos' ? 0.006 : 0.004;
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

    // ── Shepard (subliminal — 0.004 gain, buried in reverb) ──
    this.shepardGainNode = ctx.createGain();
    this.shepardGainNode.gain.value = 0.004;
    const shepardReverb = this._makeReverb(ctx, 3.0);
    const shepardLPF = ctx.createBiquadFilter();
    shepardLPF.type = 'lowpass';
    shepardLPF.frequency.value = 300;
    shepardReverb.connect(shepardLPF);
    shepardLPF.connect(this.shepardGainNode);
    this.shepardGainNode.connect(this.masterGain!);

    const BASE_FREQS = [40, 80, 160, 320, 640];
    this.shepardPhase = 0;
    BASE_FREQS.forEach((baseFreq, i) => {
      const phaseOffset = i / BASE_FREQS.length;
      const initFreq = baseFreq * Math.pow(2, phaseOffset);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = initFreq;
      const gain = ctx.createGain();
      gain.gain.value = shepardGain(initFreq);
      osc.connect(gain); gain.connect(shepardReverb); osc.start();
      this.shepardOscs.push(osc); this.shepardGains.push(gain);

      const chorus = ctx.createOscillator();
      chorus.type = 'sine';
      chorus.frequency.value = initFreq * 1.005;
      const cg = ctx.createGain();
      cg.gain.value = shepardGain(initFreq) * 0.4;
      chorus.connect(cg); cg.connect(shepardReverb); chorus.start();
      this.shepardChorusOscs.push(chorus); this.shepardChorusGains.push(cg);
    });

    const PERIOD_MS = 45000;
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
        if (this.shepardChorusOscs[i]) this.shepardChorusOscs[i].frequency.value = freq * 1.005;
        if (this.shepardChorusGains[i]) this.shepardChorusGains[i].gain.value = g * 0.4;
      });
    }, 80);

    // ── Noise floor (always on — room presence) ──
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.015;
    const noiseLPF = ctx.createBiquadFilter();
    noiseLPF.type = 'lowpass';
    noiseLPF.frequency.value = 110;
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

    // ── Cello tremolo section (always on, builds with λ) ──
    // 9Hz tremolo LFO simulates bowing — the signature Hans Zimmer string texture
    this.celloGain = ctx.createGain();
    this.celloGain.gain.value = 0.03; // starts quiet at calm

    const celloReverb = this._makeReverb(ctx, 2.0);
    const celloLPF = ctx.createBiquadFilter();
    celloLPF.type = 'lowpass';
    celloLPF.frequency.value = 500;
    this.celloGain.connect(celloReverb);
    celloReverb.connect(celloLPF);
    celloLPF.connect(this.masterGain!);

    // Tremolo LFO — modulates the gain of the cello bus
    this.celloTremoloLFO = ctx.createOscillator();
    this.celloTremoloLFO.type = 'sine';
    this.celloTremoloLFO.frequency.value = 9; // cello tremolo rate
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.6; // deep tremolo for dramatic effect
    this.celloTremoloLFO.connect(tremoloDepth);
    tremoloDepth.connect(this.celloGain.gain);
    this.celloTremoloLFO.start();

    // 4 detuned sine oscillators in cello register (65–130Hz)
    // Two clusters for a richer sound
    const celloFreqs = [65, 69, 97, 103]; // slight detuning within pairs
    this.celloOscs = celloFreqs.map(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; // triangle is warmer than sine, less organ-like
      osc.frequency.value = freq;
      osc.connect(this.celloGain!);
      osc.start();
      return osc;
    });

    // ── War drum bus (fades in at λ ≥ 1.5) ──
    // Drums are prominent — run through a large room reverb
    this.drumGain = ctx.createGain();
    this.drumGain.gain.value = 0;
    this.drumReverb = this._makeReverb(ctx, 1.8);
    this.drumGain.connect(this.drumReverb);
    this.drumReverb.connect(this.masterGain!);
    // Also connect dry signal (reverb + dry mix for punch)
    this.drumGain.connect(this.masterGain!);

    // ── Brass pulse bus ──
    this.brassGain = ctx.createGain();
    this.brassGain.gain.value = 1; // always active — controlled per-hit
    const brassReverb = this._makeReverb(ctx, 2.5);
    this.brassGain.connect(brassReverb);
    brassReverb.connect(this.masterGain!);

    // ── Tension pad (λ ≥ 2.0) ──
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padReverb = this._makeReverb(ctx, 4.0);
    this.padGain.connect(padReverb);
    padReverb.connect(this.masterGain!);
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
  // BOOM@0ms, tok@800, BOOM@1400, tok@1800, tok@2100 — cycle 3200ms

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
        if (type === 'boom') {
          this._fireBoom(this.ctx);
          this._fireBrass(this.ctx); // Zimmer brass pulse on every BOOM
        } else {
          this._fireTok(this.ctx);
        }
      }, time);
    });

    this.drumCycleTimeout = setTimeout(() => this._scheduleDrumCycle(ctx), 3200);
  }

  private _fireBoom(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Pitch drop: 55Hz → 28Hz — big chest punch
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.45);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.007); // fast attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(this.drumGain!);
    osc.start(now);
    osc.stop(now + 0.65);
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
    filter.frequency.value = 190;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    src.connect(filter); filter.connect(gain);
    gain.connect(this.drumGain!);
    src.start(now); src.stop(now + 0.085);
  }

  // Zimmer brass stab — detuned sawtooth chord at low brass register
  // Fires in sync with every BOOM for that "war movie" impact
  private _fireBrass(ctx: AudioContext): void {
    if (!this.drumActive) return; // only when drums are active
    const now = ctx.currentTime;
    // Low brass chord: trombone-ish cluster around 58Hz (Bb1) and 73Hz (D2)
    const brFreqs = [55, 58, 73, 77];
    brFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      // Slight pitch envelope: sharp attack, tiny drop for "brassiness"
      osc.frequency.setValueAtTime(freq * 1.02, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.06);
      const gain = ctx.createGain();
      const baseGain = i < 2 ? 0.07 : 0.05; // root notes louder
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(baseGain, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain);
      gain.connect(this.brassGain!);
      osc.start(now);
      osc.stop(now + 1.45);
    });
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

  private _scheduleGhost(ctx: AudioContext): void {
    if (!this.ghostActive) return;
    this.ghostTimeout = setTimeout(() => {
      if (!this.ghostActive || !this.ctx) return;
      this._fireGhost(ctx);
      this._scheduleGhost(ctx);
    }, 4000 + Math.random() * 4000);
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
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    src.connect(filter); filter.connect(reverb);
    reverb.connect(gain); gain.connect(this.masterGain!);
    src.start(now); src.stop(now + 1.25);
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
    filter.type = 'bandpass';
    filter.frequency.value = 140;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    src.connect(filter); filter.connect(gain);
    gain.connect(this.masterGain!);
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
    osc.type = 'sine';
    osc.frequency.value = 380;
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(now); osc.stop(now + 0.09);
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
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(now); osc.stop(now + 0.42);
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
    subOsc.connect(subGain); subGain.connect(this.masterGain!);
    subOsc.start(now); subOsc.stop(now + 0.55);

    const bufSize = Math.floor(ctx.sampleRate * 0.3);
    const nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = nBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = nBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 220; filter.Q.value = 1.5;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.12, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    src.connect(filter); filter.connect(nGain);
    nGain.connect(this.masterGain!);
    src.start(now); src.stop(now + 0.32);
  }

  playLambdaThreshold(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const reverb = this._makeReverb(ctx, 1.5);
    reverb.connect(this.masterGain!);
    [55, 73, 82].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain); gain.connect(reverb);
      osc.start(now); osc.stop(now + 1.45);
    });
  }
}

export const audioEngine = new AudioEngine();
