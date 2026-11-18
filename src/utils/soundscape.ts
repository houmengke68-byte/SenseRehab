import type { SceneId } from '../types';

export type SoundCueType = 'birdsong' | 'wind_leaves' | 'stream_water';

class NatureSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private timers: number[] = [];
  private isPlaying = false;
  private currentVolume = 0.4;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  startAmbient(scene: SceneId, volumePercent: number): void {
    this.stopAll();
    try {
      const ctx = this.ensureContext();
      this.currentVolume = Math.max(0, Math.min(1, volumePercent / 100)) * 0.65;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.currentVolume, ctx.currentTime, 0.25);
      }

      const noiseBuffer = this.createPinkNoiseBuffer(ctx, 5);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = scene === 'stream' ? 'bandpass' : 'lowpass';
      filter.frequency.value = scene === 'stream' ? 680 : 420;
      filter.Q.value = scene === 'stream' ? 0.9 : 0.7;

      // Slow organic LFO modulation for natural breeze / stream flow
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = scene === 'stream' ? 0.18 : 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = scene === 'stream' ? 220 : 160;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const bedGain = ctx.createGain();
      bedGain.gain.value = scene === 'stream' ? 0.65 : 0.45;

      source.connect(filter);
      filter.connect(bedGain);
      if (this.masterGain) {
        bedGain.connect(this.masterGain);
      }

      source.start();
      lfo.start();
      this.activeNodes.push(source, lfo, filter, lfoGain, bedGain);
      this.isPlaying = true;

      // Occasional soft bird note in forest (or distant in stream)
      const intervalMs = scene === 'forest' ? 4200 : 7500;
      const timerId = window.setInterval(() => {
        if (!this.isPlaying) return;
        this.playBirdChirp(scene === 'forest' ? 0.25 : 0.12);
      }, intervalMs);
      this.timers.push(timerId);
    } catch {
      // AudioContext blocked until user gesture; safe no-op
    }
  }

  setVolume(volumePercent: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volumePercent / 100)) * 0.65;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.12);
    }
  }

  playBirdChirp(gainLevel = 0.28): void {
    try {
      const ctx = this.ensureContext();
      if (!this.masterGain) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      const baseFreq = 1950 + Math.random() * 650;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.09);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.22);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(gainLevel, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Safe fallback
    }
  }

  playTaskCue(cue: SoundCueType): void {
    try {
      const ctx = this.ensureContext();
      if (!this.masterGain) return;
      if (cue === 'birdsong') {
        this.playBirdChirp(0.45);
        window.setTimeout(() => this.playBirdChirp(0.4), 320);
        return;
      }

      const noiseBuffer = this.createPinkNoiseBuffer(ctx, 2);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = cue === 'stream_water' ? 920 : 380;
      filter.Q.value = cue === 'stream_water' ? 1.4 : 0.8;

      const env = ctx.createGain();
      const now = ctx.currentTime;
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.55, now + 0.25);
      env.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      src.connect(filter);
      filter.connect(env);
      env.connect(this.masterGain);
      src.start(now);
      src.stop(now + 1.55);
    } catch {
      // Safe fallback
    }
  }

  stopAll(): void {
    this.isPlaying = false;
    this.timers.forEach((id) => window.clearInterval(id));
    this.timers = [];
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Already stopped
      }
    });
    this.activeNodes = [];
  }
}

export const soundscape = new NatureSoundscapeEngine();
