// Synthesized sound only — no audio files. A tiny WebAudio helper: short blips for
// footsteps, a two-tone sting when the alarm trips, a chime for loot, and jingles for
// winning and losing. The context is created lazily on the first user gesture, so the
// page never plays before the player touches it. Guard footsteps get louder the nearer
// the nearest guard is, so you hear a patrol coming before you see it.

export function createAudio() {
  let context = null;
  let master = null;
  let lastStep = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, when = 0, slideTo = null) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  return {
    /** Call from any user gesture: unlocks sound for the rest of the visit. */
    unlock() {
      ensure();
    },
    /** A footstep tick. `sneak` is softer; `near` (0..1) is how close the nearest guard is. */
    step(sneak, near = 0) {
      const now = performance.now();
      if (now - lastStep < (sneak ? 340 : 260)) return;
      lastStep = now;
      const volume = sneak ? 0.05 : 0.08 + near * 0.1;
      tone(180 + Math.random() * 40, 0.06, 'triangle', volume);
    },
    /** Guard footstep heard nearby: a low thud that tells you a patrol is close. */
    guardStep(near) {
      tone(110, 0.09, 'sine', 0.04 + near * 0.12);
    },
    /** The alarm trips: a rising two-tone sting. */
    alarm() {
      tone(440, 0.16, 'square', 0.12);
      tone(587, 0.22, 'square', 0.12, 0.16);
      tone(880, 0.3, 'square', 0.1, 0.36, 660);
    },
    /** The alarm calms: a falling sigh. */
    calm() {
      tone(587, 0.18, 'sine', 0.1, 0, 440);
    },
    /** Loot grabbed: a bright chime. */
    grab() {
      tone(880, 0.12, 'sine', 0.14);
      tone(1318, 0.2, 'sine', 0.12, 0.08);
    },
    /** Caught: a low thud. */
    caught() {
      tone(220, 0.25, 'sawtooth', 0.12, 0, 110);
    },
    /** Zone cleared: a short rising run. */
    zone() {
      tone(523, 0.12, 'sine', 0.12);
      tone(659, 0.12, 'sine', 0.12, 0.1);
      tone(784, 0.2, 'sine', 0.12, 0.2);
    },
    /** Escape with the keris: a little gamelan-like jingle. */
    win() {
      [523, 659, 784, 1046, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.12, i * 0.13));
    },
    /** Game over: a falling line. */
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.28, 'triangle', 0.11, i * 0.16));
    },
  };
}
