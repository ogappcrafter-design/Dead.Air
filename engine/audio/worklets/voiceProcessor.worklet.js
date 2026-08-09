// engine/audio/worklets/voiceProcessor.worklet.js
// AudioWorkletProcessor for voice processing: EQ bandpass + compression + bitcrush.
// Runs on the audio thread for lower latency vs JS-thread processing.
//
// Parameters (via AudioParam on the AudioWorkletNode):
// - eqCenter: EQ bandpass center frequency (Hz)
// - eqQ: EQ bandpass Q
// - compThreshold: compressor threshold (dB)
// - compRatio: compressor ratio (N:1)
// - outputGain: output gain (0..1)
// - bitcrushDepth: bitcrush depth (0..1)
//
// This worklet is a simplified real-time DSP approximation of the
// VoiceProcessor chain. It runs independently of the PlatformBridge
// abstraction and requires a real Web Audio context.

class VoiceProcessorWorklet extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const params = (options && options.processorOptions) || {};
    this.sampleRate = sampleRate; // global in AudioWorkletGlobalScope
    this.eqCenter = params.eqCenter || 1800;
    this.eqQ = params.eqQ || 0.8;
    this.compThreshold = params.compThreshold || -24;
    this.compRatio = params.compRatio || 3;
    this.outputGain = params.outputGain || 0.85;
    this.bitcrushDepth = params.bitcrushDepth || 0.05;

    this.prevX1 = 0;
    this.prevX2 = 0;
    this.prevY1 = 0;
    this.prevY2 = 0;

    // Compressor state
    this.compEnv = 0;

    // Listen for parameter updates from the main thread
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.eqCenter !== undefined) this.eqCenter = d.eqCenter;
      if (d.eqQ !== undefined) this.eqQ = d.eqQ;
      if (d.compThreshold !== undefined) this.compThreshold = d.compThreshold;
      if (d.compRatio !== undefined) this.compRatio = d.compRatio;
      if (d.outputGain !== undefined) this.outputGain = d.outputGain;
      if (d.bitcrushDepth !== undefined) this.bitcrushDepth = d.bitcrushDepth;
    };
  }

  bandpass(x, cutoff, Q) {
    const w = (2 * Math.PI * cutoff) / this.sampleRate;
    const alpha = Math.sin(w) / (2 * Q);
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w);
    const a2 = 1 - alpha;

    const y =
      (b0 * x + b1 * this.prevX1 + b2 * this.prevX2 - a1 * this.prevY1 - a2 * this.prevY2) / a0;
    this.prevX2 = this.prevX1;
    this.prevX1 = x;
    this.prevY2 = this.prevY1;
    this.prevY1 = y;
    return y;
  }

  // Simple compressor
  compress(x) {
    const abs = Math.abs(x);
    if (abs > 0) {
      const db = 20 * Math.log10(abs);
      const over = db - this.compThreshold;
      if (over > 0) {
        const reduction = over * (1 - 1 / this.compRatio);
        const targetDb = db - reduction;
        const target = Math.pow(10, targetDb / 20);
        // Envelope follower — smooth attack/release
        this.compEnv = this.compEnv * 0.99 + target * 0.01;
        return Math.sign(x) * this.compEnv;
      }
    }
    this.compEnv = this.compEnv * 0.99 + abs * 0.01;
    return x;
  }

  // Bitcrush — quantize to N levels
  bitcrush(x, depth) {
    const levels = Math.max(2, Math.round(Math.pow(2, 8 - depth * 7)));
    const step = 2 / levels;
    return Math.round(x / step) * step;
  }

  process(inputs, outputs, _parameters) {
    const input = inputs[0];
    const output = outputs[0];

    for (let ch = 0; ch < output.length; ch++) {
      const inCh = (input && input[ch]) || new Float32Array(output[ch].length);
      const outCh = output[ch];

      this.prevX1 = 0;
      this.prevX2 = 0;
      this.prevY1 = 0;
      this.prevY2 = 0;
      this.compEnv = 0;

      for (let i = 0; i < outCh.length; i++) {
        let s = inCh[i] || 0;
        // EQ bandpass
        s = this.bandpass(s, this.eqCenter, this.eqQ);
        // Compression
        s = this.compress(s);
        // Bitcrush
        s = this.bitcrush(s, this.bitcrushDepth);
        // Output gain
        outCh[i] = s * this.outputGain;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('voice-processor', VoiceProcessorWorklet);
