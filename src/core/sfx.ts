/** Audio 100% procedural con WebAudio: ambiente, pasos, puertas, UI. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private volume = 0.8;

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  init() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    this.noiseBuf = buf;
    this.startAmbience();
  }

  private startAmbience() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 130;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();

    const hum = ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 49;
    const hg = ctx.createGain();
    hg.gain.value = 0.012;
    hum.connect(hg);
    hg.connect(this.master);
    hum.start();

    const loop = () => {
      setTimeout(() => {
        this.distant();
        loop();
      }, 14000 + Math.random() * 26000);
    };
    loop();
  }

  private noiseBurst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = "bandpass") {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 1.2, dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = "sine", endFreq?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  step() {
    this.noiseBurst(0.09, 260 + Math.random() * 160, 1.2, 0.16, "bandpass");
  }

  blip() {
    this.tone(620 + Math.random() * 80, 0.025, 0.028, "square");
  }

  pickup() {
    this.tone(440, 0.09, 0.06, "triangle");
    setTimeout(() => this.tone(660, 0.12, 0.06, "triangle"), 80);
  }

  doorCreak() {
    this.tone(150, 0.7, 0.05, "sawtooth", 78);
    this.noiseBurst(0.5, 900, 3, 0.05, "bandpass");
  }

  locked() {
    this.tone(95, 0.14, 0.14, "sine", 70);
    this.noiseBurst(0.06, 1800, 2, 0.06, "highpass");
  }

  unlock() {
    this.noiseBurst(0.05, 2400, 4, 0.1, "highpass");
    setTimeout(() => this.noiseBurst(0.06, 1500, 4, 0.1, "bandpass"), 110);
  }

  keyBeep() {
    this.tone(880, 0.05, 0.045, "square");
  }

  switchClick() {
    this.noiseBurst(0.03, 2600, 3, 0.12, "highpass");
  }

  /** Punzada de susto: chirrido disonante + golpe grave. */
  sting() {
    this.tone(400, 0.5, 0.085, "sawtooth", 950);
    this.tone(383, 0.5, 0.085, "sawtooth", 905);
    this.noiseBurst(0.35, 2300, 1.4, 0.11, "highpass");
    this.tone(56, 0.55, 0.16, "sine", 38);
  }

  place() {
    this.noiseBurst(0.08, 900, 2, 0.12, "bandpass");
    setTimeout(() => this.tone(340, 0.25, 0.06, "sine", 250), 90);
  }

  // ---- televisor ----
  private tvSrc: AudioBufferSourceNode | null = null;
  private tvFilter: BiquadFilterNode | null = null;
  private tvGain: GainNode | null = null;
  private jingleTimer: number | null = null;
  private jingleStep = 0;

  tvStart() {
    if (!this.ctx || this.tvSrc) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 1.5;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1400;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.13;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    this.tvSrc = src;
    this.tvFilter = f;
    this.tvGain = g;
  }

  /** El carácter del ruido cambia con el dial; se apaga al sintonizar. */
  tvTune(clarity: number, dial: number) {
    if (!this.tvGain || !this.tvFilter) return;
    this.tvGain.gain.value = 0.02 + 0.13 * (1 - clarity);
    this.tvFilter.frequency.value = 500 + dial * 3400;
    this.tvFilter.Q.value = 0.4 + clarity * 2.5;
  }

  tvStop() {
    this.tvSrc?.stop();
    this.tvSrc?.disconnect();
    this.tvFilter?.disconnect();
    this.tvGain?.disconnect();
    this.tvSrc = null;
    this.tvFilter = null;
    this.tvGain = null;
    this.jingleStop();
  }

  /** Melodía propia del anuncio de Mudanzas Serna, en bucle. */
  jingleStart() {
    if (this.jingleTimer || !this.ctx) return;
    const seq = [392, 523, 659, 784, 0, 659, 784, 880, 784, 659, 523, 0, 587, 659, 523, 0];
    this.jingleStep = 0;
    this.jingleTimer = window.setInterval(() => {
      const f = seq[this.jingleStep % seq.length];
      if (f > 0) {
        this.tone(f, 0.14, 0.045, "square");
        this.tone(f / 2, 0.16, 0.03, "triangle");
      }
      this.jingleStep++;
    }, 190);
  }

  jingleStop() {
    if (this.jingleTimer) {
      window.clearInterval(this.jingleTimer);
      this.jingleTimer = null;
    }
  }

  // ---- persecución (ALA C) ----
  private chaseTimer: number | null = null;
  private chaseStep = 0;

  /** Bucle tenso propio: pulso grave frenético con punzadas disonantes. */
  chaseStart() {
    if (this.chaseTimer || !this.ctx) return;
    this.chaseStep = 0;
    this.chaseTimer = window.setInterval(() => {
      const seq = [98, 98, 104, 98, 98, 110, 104, 98];
      const f = seq[this.chaseStep % seq.length];
      this.tone(f, 0.11, 0.085, "square");
      this.tone(f / 2, 0.13, 0.075, "sawtooth");
      if (this.chaseStep % 8 === 6) {
        this.tone(415, 0.28, 0.05, "sawtooth", 392);
        this.tone(311, 0.28, 0.045, "sawtooth", 330);
      }
      if (this.chaseStep % 4 === 2) this.noiseBurst(0.05, 3000, 2, 0.05, "highpass");
      this.chaseStep++;
    }, 150);
  }

  chaseStop() {
    if (this.chaseTimer) {
      window.clearInterval(this.chaseTimer);
      this.chaseTimer = null;
    }
  }

  /** Grito de alerta del celador al verte. */
  alert() {
    this.tone(220, 0.16, 0.12, "sawtooth", 340);
    setTimeout(() => this.tone(340, 0.2, 0.12, "sawtooth", 260), 140);
    this.noiseBurst(0.12, 1400, 1.5, 0.1, "bandpass");
  }

  /**
   * Tic del candado al hurgar. El rango es MUY amplio a propósito: si el tono
   * apenas cambia cerca del punto, el jugador no puede distinguirlo de oído.
   */
  lockTick(p: number) {
    this.tone(240 + p * p * 1760, 0.035, 0.012 + p * p * 0.16, "square");
    if (p > 0.72) this.noiseBurst(0.03, 2600, 3, 0.05 + p * 0.09, "highpass");
  }

  /** El CLICK bueno del candado. */
  lockClack() {
    this.noiseBurst(0.05, 1800, 3, 0.16, "bandpass");
    this.tone(220, 0.09, 0.12, "square", 170);
  }

  /** Golpe seco de cuerpo contra el suelo. */
  thud() {
    this.tone(92, 0.24, 0.15, "sine", 52);
    this.noiseBurst(0.12, 380, 1, 0.13, "lowpass");
  }

  /** Te han atrapado. */
  caught() {
    this.tone(70, 0.4, 0.2, "sine", 40);
    this.noiseBurst(0.2, 500, 1, 0.16, "lowpass");
    setTimeout(() => this.tone(55, 0.5, 0.16, "sine", 35), 220);
  }

  glass() {
    this.noiseBurst(0.25, 3200, 1.2, 0.22, "highpass");
    setTimeout(() => this.noiseBurst(0.18, 2400, 2, 0.13, "highpass"), 90);
    setTimeout(() => this.noiseBurst(0.12, 4200, 2, 0.08, "highpass"), 210);
    this.tone(120, 0.12, 0.1, "sine", 80);
  }

  error() {
    this.tone(160, 0.22, 0.07, "square", 120);
  }

  save() {
    this.tone(520, 0.1, 0.05, "sine");
    setTimeout(() => this.tone(780, 0.18, 0.05, "sine"), 110);
  }

  distant() {
    this.tone(72, 1.8, 0.05, "sine", 44);
    setTimeout(() => this.noiseBurst(0.9, 300, 1, 0.02, "lowpass"), 300);
  }
}
