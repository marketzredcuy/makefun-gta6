// Small synthesised sounds through WebAudio: no audio files, nothing fetched.
// The context is created on the first user gesture (browsers block audio
// before one), and every call is a no-op until then, so headless screenshots
// run silent without errors.

export function createSound() {
  let ctx = null;
  let muted = false;
  let sirenTimer = null;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** A short tone. */
  function tone(freq, seconds, type, volume, when = 0) {
    const audio = ensure();
    if (!audio || muted) return;
    try {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audio.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + when + seconds);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(audio.currentTime + when);
      osc.stop(audio.currentTime + when + seconds + 0.02);
    } catch {
      // Audio is decoration: a failure never breaks the game.
    }
  }

  /** A burst of filtered noise, for crashes. */
  function noise(seconds, volume) {
    const audio = ensure();
    if (!audio || muted) return;
    try {
      const length = Math.floor(audio.sampleRate * seconds);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const gain = audio.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(audio.destination);
      source.start();
    } catch {
      // Audio is decoration: a failure never breaks the game.
    }
  }

  return {
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() {
      const audio = ensure();
      if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (muted) this.stopSiren();
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.18);
      tone(990, 0.12, 'sine', 0.18, 0.08);
    },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.2);
      tone(659, 0.12, 'triangle', 0.2, 0.1);
      tone(784, 0.2, 'triangle', 0.22, 0.2);
    },
    crash() {
      noise(0.25, 0.35);
      tone(90, 0.2, 'sawtooth', 0.2);
    },
    horn() {
      tone(370, 0.18, 'square', 0.08);
    },
    /** The two-tone police siren, while the player is wanted. */
    startSiren() {
      const audio = ensure();
      if (!audio || muted || sirenTimer !== null) return;
      let high = false;
      sirenTimer = window.setInterval(() => {
        if (muted) return;
        tone(high ? 950 : 700, 0.28, 'sine', 0.05);
        high = !high;
      }, 300);
    },
    stopSiren() {
      if (sirenTimer !== null) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
      }
    },
    /** The engine hum, its pitch following the car's speed (0 to 1). */
    setEngine(speedRatio) {
      const audio = ensure();
      if (!audio || muted) {
        if (engineOsc) {
          try {
            engineOsc.stop();
          } catch {
            // Already stopped.
          }
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      try {
        if (!engineOsc) {
          engineOsc = audio.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = audio.createGain();
          engineGain.gain.value = 0.0;
          engineOsc.connect(engineGain);
          engineGain.connect(audio.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speedRatio * 140;
        engineGain.gain.value = 0.015 + speedRatio * 0.03;
      } catch {
        // Audio is decoration: a failure never breaks the game.
      }
    },
  };
}
