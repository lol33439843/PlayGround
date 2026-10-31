// Tiny procedural sound engine — no audio assets required.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.last = Object.create(null);
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.55 : 0;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(value) {
    this.enabled = value;
    if (this.master) {
      this.master.gain.setTargetAtTime(value ? 0.55 : 0, this.ctx.currentTime, 0.02);
    }
  }

  tone(freq, endFreq, dur, type, vol, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur, vol, cutoff, delay = 0, highpass = false) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = highpass ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t0);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (name === 'shoot' || name === 'kill' || name === 'frost') {
      if (this.last[name] && now - this.last[name] < 0.045) return;
      this.last[name] = now;
    }
    switch (name) {
      case 'shoot':
        this.tone(920, 430, 0.07, 'square', 0.016);
        break;
      case 'cannon':
        this.tone(150, 48, 0.3, 'sine', 0.085);
        this.noise(0.24, 0.05, 800);
        break;
      case 'frost':
        this.tone(1500, 720, 0.14, 'sine', 0.026);
        break;
      case 'arc':
        this.noise(0.12, 0.035, 3200, 0, true);
        this.tone(240, 680, 0.1, 'sawtooth', 0.018);
        break;
      case 'rail':
        this.tone(1800, 180, 0.22, 'sawtooth', 0.04);
        this.noise(0.16, 0.03, 2400, 0, true);
        break;
      case 'place':
        this.tone(300, 540, 0.09, 'triangle', 0.05);
        this.tone(620, 820, 0.08, 'sine', 0.028, 0.05);
        break;
      case 'upgrade':
        this.tone(523, 523, 0.09, 'triangle', 0.04);
        this.tone(659, 659, 0.09, 'triangle', 0.04, 0.07);
        this.tone(784, 784, 0.14, 'triangle', 0.045, 0.14);
        break;
      case 'sell':
        this.tone(620, 320, 0.16, 'triangle', 0.04);
        break;
      case 'kill':
        this.tone(210, 82, 0.1, 'triangle', 0.022);
        break;
      case 'leak':
        this.tone(200, 90, 0.35, 'sawtooth', 0.06);
        this.tone(140, 70, 0.4, 'sawtooth', 0.05, 0.08);
        break;
      case 'wave':
        this.tone(220, 220, 0.22, 'sawtooth', 0.03);
        this.tone(330, 330, 0.22, 'sawtooth', 0.028, 0.1);
        this.tone(440, 440, 0.3, 'triangle', 0.03, 0.2);
        break;
      case 'boss':
        this.tone(95, 38, 0.6, 'sawtooth', 0.06);
        this.noise(0.5, 0.04, 400);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.28, 'triangle', 0.045, i * 0.12));
        break;
      case 'click':
        this.tone(540, 700, 0.045, 'triangle', 0.025);
        break;
      case 'error':
        this.tone(180, 130, 0.12, 'square', 0.03);
        break;
      default:
        break;
    }
  }
}

export const sound = new SoundEngine();
