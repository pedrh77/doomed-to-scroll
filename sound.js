"use strict";

(function exposeSound(global) {
  class GameSound {
    constructor() {
      this.context = null;
      this.lastPlayed = new Map();
      this.patterns = {
        drag: [[180, .035, "square", .018], [230, .04, "square", .012]],
        success: [[520, .07, "square", .035], [690, .08, "square", .035], [880, .13, "square", .04]],
        error: [[190, .12, "sawtooth", .045], [125, .18, "square", .035]],
        energyLoss: [[310, .06, "square", .025], [180, .12, "sawtooth", .028]],
        monster: [[90, .16, "sawtooth", .04], [135, .12, "square", .035], [75, .2, "sawtooth", .045]],
        countdown: [[440, .08, "square", .03]],
        victory: [[392, .08, "square", .035], [523, .09, "square", .04], [659, .18, "square", .045]],
        defeat: [[260, .12, "sawtooth", .04], [190, .15, "sawtooth", .04], [105, .25, "square", .04]],
        item: [[660, .06, "triangle", .035], [880, .09, "square", .035], [1040, .14, "triangle", .03]],
        boss: [[70, .22, "sawtooth", .055], [105, .18, "square", .045], [58, .34, "sawtooth", .06]],
        save: [[480, .05, "square", .025], [720, .1, "triangle", .03]]
      };
    }

    unlock() {
      const AudioContext = global.AudioContext || global.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === "suspended") this.context.resume();
    }

    play(name) {
      this.unlock();
      if (!this.context || !this.patterns[name]) return;
      const now = performance.now();
      if (now - (this.lastPlayed.get(name) || 0) < (name === "drag" ? 90 : 25)) return;
      this.lastPlayed.set(name, now);
      let offset = 0;
      this.patterns[name].forEach(([frequency, duration, type, volume]) => {
        this.tone(frequency, duration, type, volume, offset);
        offset += duration * .72;
      });
    }

    tone(frequency, duration, type, volume, offset = 0) {
      const start = this.context.currentTime + offset;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * .82), start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    }
  }

  global.DtsSound = new GameSound();
})(typeof window !== "undefined" ? window : globalThis);
