// Synthesised sound only: every effect and the music loop are built with
// WebAudio oscillators and filtered noise, so the game ships no audio files
// and makes no network request. Audio starts on the first user gesture.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let musicStep = 0;

  // A laid-back synthwave bassline in A minor, one bar of eight steps.
  const BASSLINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  const CHORDS = [220, 261.63, 329.63];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine drone: a sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const bass = BASSLINE[musicStep % BASSLINE.length];
      if (bass > 0) tone(bass, 0.24, 'triangle', 0.16);
      if (musicStep % 4 === 0) {
        tone(CHORDS[(musicStep / 4) % CHORDS.length | 0], 0.5, 'sine', 0.05);
      }
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.03, 6000);
      musicStep += 1;
    }, 150);
  }

  return {
    unlock() {
      if (ensure()) startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setEngine(speed01, on) {
      if (!ctx || !engineGain || !engineOsc) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 110, ctx.currentTime, 0.08);
    },
    shoot() {
      noiseBurst(0.12, 0.5, 2800);
      tone(180, 0.08, 'square', 0.18, 60);
    },
    hit() {
      tone(220, 0.12, 'sawtooth', 0.2, 110);
    },
    cash() {
      tone(880, 0.09, 'sine', 0.2);
      window.setTimeout(() => tone(1318, 0.14, 'sine', 0.2), 90);
    },
    siren(on) {
      if (!ctx) return;
      if (on && !this._sirenTimer) {
        let high = true;
        this._sirenTimer = window.setInterval(() => {
          tone(high ? 950 : 700, 0.32, 'sine', 0.05);
          high = !high;
        }, 340);
      } else if (!on && this._sirenTimer) {
        window.clearInterval(this._sirenTimer);
        this._sirenTimer = null;
      }
    },
    crash() {
      noiseBurst(0.25, 0.5, 900);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.2, 990);
    },
    mission() {
      [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.15), i * 160));
    },
  };
}
