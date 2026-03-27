// frontend/src/utils/audioEngine.ts
// Cinematic audio engine v6 — Dune / tactical wargame architecture.
// Reference: Hans Zimmer — Dune (2021). Ethnic percussion, metallic rings,
// processed voice texture, 5-beat tactical rhythm, deep sub presence.

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
  const center = Math.log2(55);
  const sigma = 1.5;
  return Math.exp(-0.5 * Math.pow((logF - center) / sigma, 2));
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private musicRunning = false;
  private currentTier: LambdaTier = 'calm';

  // Shepard (subliminal)
  private shepardOscs: OscillatorNode[] = [];
  private shepardGains: GainNode[] = [];
  private shepardGainNode: GainNode | null = null;
  private shepardPhase = 0;
  private shepardTimer: ReturnType<typeof setInterval> | null = null;

  // Sub floor (always on)
  private subGain: GainNode | null = null;

  // Dune voice texture (always on — processed formant drone)
  private voiceGain: GainNode | null = null;
  private voiceOscs: OscillatorNode[] = [];

  // Tactical rhythm bus (λ ≥ 1.5)
  private rhythmGain: GainNode | null = null;
  private rhythmActive = false;
  private rhythmCycleTimeout: ReturnType<typeof setTimeout> | null = null;

  // Deep tension layer (λ ≥ 2.0)
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  // Ghost resonance (λ ≥ 2.5)
  private ghostActive = false;
  private ghostTimeout: ReturnType<typeof setTimeout> | null = null;

  // Tick
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
    this.rhythmActive = false;
    this.ghostActive = false;

    if (this.shepardTimer !== null)       { clearInterval(this.shepardTimer); this.shepardTimer = null; }
    if (this.tickInterval !== null)        { clearInterval(this.tickInterval); this.tickInterval = null; }
    if (this.rhythmCycleTimeout !== null)  { clearTimeout(this.rhythmCycleTimeout); this.rhythmCycleTimeout = null; }
    if (this.ghostTimeout !== null)        { clearTimeout(this.ghostTimeout); this.ghostTimeout = null; }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      [this.shepardGainNode, this.subGain, this.voiceGain, this.rhythmGain, this.padGain]
        .forEach(g => {
          if (g) { g.gain.cancelScheduledValues(now); g.gain.linearRampToValueAtTime(0, now + 1.5); }
        });
      setTimeout(() => {
        [...this.shepardOscs, ...this.voiceOscs, ...this.padOscs].forEach(o => {
          if (o) { try { o.stop(); } catch {} }
        });
        this.shepardOscs = []; this.shepardGains = [];
        this.voiceOscs = []; this.padOscs = [];
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
    const RAMP = 3.5;

    // Voice texture: builds with λ
    if (this.voiceGain) {
      const targets: Record<LambdaTier, number> = { calm: 0.04, tension: 0.07, crisis: 0.1, chaos: 0.13 };
      this.voiceGain.gain.cancelScheduledValues(now);
      this.voiceGain.gain.linearRampToValueAtTime(targets[tier], now + RAMP);
    }

    // Tactical rhythm: on at tension+
    if (this.rhythmGain) {
      const target = tier === 'calm' ? 0 : 1;
      this.rhythmGain.gain.cancelScheduledValues(now);
      this.rhythmGain.gain.linearRampToValueAtTime(target, now + RAMP);
      if (tier !== 'calm' && !this.rhythmActive) {
        this.rhythmActive = true;
        this._scheduleRhythmCycle(ctx);
      } else if (tier === 'calm') {
        this.rhythmActive = false;
      }
    }

    // Deep pad: on at crisis+
    if (this.padGain) {
      const target = (tier === 'crisis' || tier === 'chaos') ? 0.06 : 0;
      this.padGain.gain.cancelScheduledValues(now);
      this.padGain.gain.linearRampToValueAtTime(target, now + RAMP);
    }

    // Shepard: truly subliminal
    if (this.shepardGainNode) {
      const target = tier === 'chaos' ? 0.005 : 0.003;
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

    // ── Shepard (subliminal — 0.003, 60s cycle, heavy LPF) ──
    this.shepardGainNode = ctx.createGain();
    this.shepardGainNode.gain.value = 0.003;
    const shepReverb = this._makeReverb(ctx, 4.0);
    const shepLPF = ctx.createBiquadFilter();
    shepLPF.type = 'lowpass'; shepLPF.frequency.value = 200;
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

    let lastShepTime = performance.now();
    this.shepardTimer = setInterval(() => {
      if (!this.musicRunning) return;
      const now = performance.now();
      const dt = (now - lastShepTime) / 60000;
      lastShepTime = now;
      this.shepardPhase = (this.shepardPhase + dt) % 1;
      BASE_FREQS.forEach((baseFreq, i) => {
        const phase = (this.shepardPhase + i / BASE_FREQS.length) % 1;
        const freq = baseFreq * Math.pow(2, phase);
        if (this.shepardOscs[i]) this.shepardOscs[i].frequency.value = freq;
        if (this.shepardGains[i]) this.shepardGains[i].gain.value = shepardGain(freq);
      });
    }, 120);

    // ── Sub floor (always on — brown noise <80Hz) ──
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.02;
    const subLPF = ctx.createBiquadFilter();
    subLPF.type = 'lowpass'; subLPF.frequency.value = 80;
    this.subGain.connect(subLPF); subLPF.connect(this.masterGain!);
    const subLen = Math.floor(ctx.sampleRate * 5);
    const subBuf = ctx.createBuffer(1, subLen, ctx.sampleRate);
    const sd = subBuf.getChannelData(0);
    let sv = 0;
    for (let i = 0; i < subLen; i++) { sv = (sv + 0.015 * (Math.random() * 2 - 1)) / 1.015; sd[i] = sv * 4; }
    const subLoop = ctx.createBufferSource();
    subLoop.buffer = subBuf; subLoop.loop = true;
    subLoop.connect(this.subGain); subLoop.start();

    // ── Dune voice texture (formant drone — alien/human hybrid) ──
    // Simulates the processed choir quality of Zimmer's Dune sound.
    // Three formant layers ("oooh" vowel shape): F1≈280Hz, F2≈700Hz, F3≈2200Hz
    // Only F1 and F2 used (keep it dark, no brightness).
    // Each formant = narrow bandpass over looping noise + slow vibrato.
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0.04;
    const voiceReverb = this._makeReverb(ctx, 4.5);
    this.voiceGain.connect(voiceReverb); voiceReverb.connect(this.masterGain!);

    // Also add direct dry path at lower level (gives definition)
    const voiceDryGain = ctx.createGain();
    voiceDryGain.gain.value = 0.008;
    this.voiceGain.connect(voiceDryGain); voiceDryGain.connect(this.masterGain!);

    const formantData = [
      { freq: 275, Q: 8,  vibRate: 0.15, vibDepth: 6  },  // F1 low vowel
      { freq: 690, Q: 12, vibRate: 0.11, vibDepth: 10 },  // F2 vowel character
      { freq: 265, Q: 6,  vibRate: 0.08, vibDepth: 4  },  // F1 detuned copy
      { freq: 710, Q: 10, vibRate: 0.13, vibDepth: 8  },  // F2 detuned copy
    ];

    // Shared noise buffer for all formants
    const vNoiseLen = Math.floor(ctx.sampleRate * 3);
    const vNoiseBuf = ctx.createBuffer(1, vNoiseLen, ctx.sampleRate);
    const vnd = vNoiseBuf.getChannelData(0);
    for (let i = 0; i < vNoiseLen; i++) vnd[i] = Math.random() * 2 - 1;

    formantData.forEach(f => {
      const src = ctx.createBufferSource();
      src.buffer = vNoiseBuf; src.loop = true;

      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = f.freq;
      bpf.Q.value = f.Q;

      // Slow vibrato on formant frequency
      const vib = ctx.createOscillator();
      vib.type = 'sine'; vib.frequency.value = f.vibRate;
      const vibDepth = ctx.createGain();
      vibDepth.gain.value = f.vibDepth;
      vib.connect(vibDepth); vibDepth.connect(bpf.frequency);
      vib.start();
      this.voiceOscs.push(vib);

      const fGain = ctx.createGain();
      fGain.gain.value = 0.35;
      src.connect(bpf); bpf.connect(fGain); fGain.connect(this.voiceGain!);
      src.start();
    });

    // ── Tactical rhythm bus (fades in at λ ≥ 1.5) ──
    this.rhythmGain = ctx.createGain();
    this.rhythmGain.gain.value = 0;
    const rhythmReverb = this._makeReverb(ctx, 1.2);
    // Wet + dry: reverb for space, direct for punch
    this.rhythmGain.connect(rhythmReverb); rhythmReverb.connect(this.masterGain!);
    this.rhythmGain.connect(this.masterGain!);

    // ── Deep pad (λ ≥ 2.0) ──
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padReverb = this._makeReverb(ctx, 5.0);
    const padLPF = ctx.createBiquadFilter();
    padLPF.type = 'lowpass'; padLPF.frequency.value = 280;
    this.padGain.connect(padReverb); padReverb.connect(padLPF); padLPF.connect(this.masterGain!);
    [41, 49, 55, 65, 82].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      osc.connect(this.padGain!); osc.start();
      this.padOscs.push(osc);
    });
  }

  // ── Tactical rhythm — 5-beat cycle ────────────────────────────────────────
  // 5 beats at 60 BPM = 5000ms cycle. Irregular accent pattern: calculated, alien.
  // Pattern: [THUD@0, metal@1100, snap@2000, metal@2900, snap-light@3700]
  // The 5-beat grid (vs 4/4) gives the tactical, slightly inhuman quality.

  private _scheduleRhythmCycle(ctx: AudioContext): void {
    if (!this.rhythmActive || !this.musicRunning) return;

    const hits: Array<{ time: number; type: 'thud' | 'metal' | 'snap' | 'snap-light' }> = [
      { time: 0,    type: 'thud'       },
      { time: 1100, type: 'metal'      },
      { time: 2000, type: 'snap'       },
      { time: 2900, type: 'metal'      },
      { time: 3700, type: 'snap-light' },
    ];

    hits.forEach(({ time, type }) => {
      setTimeout(() => {
        if (!this.rhythmActive || !this.ctx) return;
        switch (type) {
          case 'thud':       this._fireThud(this.ctx); break;
          case 'metal':      this._fireMetal(this.ctx); break;
          case 'snap':       this._fireSnap(this.ctx, 0.065); break;
          case 'snap-light': this._fireSnap(this.ctx, 0.032); break;
        }
      }, time);
    });

    this.rhythmCycleTimeout = setTimeout(() => this._scheduleRhythmCycle(ctx), 5000);
  }

  // Tribal sub drum — low, fast, no pitch ring
  private _fireThud(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(52, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.52, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain); gain.connect(this.rhythmGain!);
    osc.start(now); osc.stop(now + 0.5);
  }

  // Metallic ring — like a struck bowl or anvil edge. Short, resonant, mid-high.
  // This is the distinctive Dune percussion timbre.
  private _fireMetal(ctx: AudioContext): void {
    const now = ctx.currentTime;
    // Two detuned high-Q resonators for the metallic ring character
    [520, 538].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Slight pitch drop — metal resonance characteristic
      osc.frequency.setValueAtTime(freq * 1.04, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.072, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain); gain.connect(this.rhythmGain!);
      osc.start(now); osc.stop(now + 0.6);
    });

    // Short noise transient for the attack "click"
    const bufSize = Math.floor(ctx.sampleRate * 0.015);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 2200; filter.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    src.connect(filter); filter.connect(g); g.connect(this.rhythmGain!);
    src.start(now); src.stop(now + 0.018);
  }

  // Dry mid snap — tactical readout feel
  private _fireSnap(ctx: AudioContext, gainAmt: number): void {
    const now = ctx.currentTime;
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 240; filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainAmt * 1.5, now); // boosted
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(filter); filter.connect(gain); gain.connect(this.rhythmGain!);
    src.start(now); src.stop(now + 0.065);
  }

  // ── Ghost ─────────────────────────────────────────────────────────────────

  private _scheduleGhost(ctx: AudioContext): void {
    if (!this.ghostActive) return;
    this.ghostTimeout = setTimeout(() => {
      if (!this.ghostActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      // Deep resonant groan — Dune-style
      [180, 190].forEach(freq => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine'; osc.frequency.value = freq;
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.038, now + 0.4);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        const rev = this._makeReverb(this.ctx!, 2.5);
        osc.connect(g); g.connect(rev); rev.connect(this.masterGain!);
        osc.start(now); osc.stop(now + 2.1);
      });
      this._scheduleGhost(ctx);
    }, 5000 + Math.random() * 6000);
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
    const bufSize = Math.floor(ctx.sampleRate * 0.018);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 130; filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.007, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain!);
    src.start(now); src.stop(now + 0.02);
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
    // Tactical click — metal-tinged, short
    [480, 490].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain); gain.connect(this.masterGain!);
      osc.start(now); osc.stop(now + 0.13);
    });
  }

  playPhaseTransition(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.35);
    gain.gain.setValueAtTime(0.048, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain); gain.connect(this.masterGain!);
    osc.start(now); osc.stop(now + 0.6);
  }

  playCascadeFire(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Heavy sub impact
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.4);
    subG.gain.setValueAtTime(0.2, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subG); subG.connect(this.masterGain!);
    sub.start(now); sub.stop(now + 0.65);

    // Metallic ring layer (cascade = something structural breaking)
    [440, 455].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain); gain.connect(this.masterGain!);
      osc.start(now); osc.stop(now + 0.85);
    });
  }

  playLambdaThreshold(): void {
    const ctx = this.ensureReady();
    if (!ctx) return;
    const now = ctx.currentTime;
    const reverb = this._makeReverb(ctx, 2.0);
    reverb.connect(this.masterGain!);
    [44, 52, 66].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc.connect(gain); gain.connect(reverb);
      osc.start(now); osc.stop(now + 1.65);
    });
  }
}

export const audioEngine = new AudioEngine();
