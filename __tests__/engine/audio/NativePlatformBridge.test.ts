// __tests__/engine/audio/NativePlatformBridge.test.ts
// DEA-94 native path: PCM sources render the offline voice chain into a WAV
// data URI and hand it to expo-audio.

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(async () => {}),
  setIsAudioActiveAsync: jest.fn(async () => {}),
}));

import { createAudioPlayer } from 'expo-audio';
import {
  NATIVE_SAMPLE_RATE,
  NativePlatformBridge,
  type NativePcmPlayerHandle,
} from '../../../engine/audio/platform/native/NativePlatformBridge';
import { NativeAudioUnsupportedError } from '../../../engine/audio/platform/native/NativeAudioGraph';
import { makeBitcrushCurve } from '../../../engine/audio/VoiceProcessor';
import type { BridgeAudioContext, BridgeAudioNode } from '../../../engine/audio/PlatformBridge';

interface FakePlayer extends NativePcmPlayerHandle {
  readonly uri: string;
  playCalls: number;
  pauseCalls: number;
  removeCalls: number;
}

const makePlayerFactory = (): {
  factory: (uri: string) => FakePlayer;
  players: FakePlayer[];
} => {
  const players: FakePlayer[] = [];
  const factory = (uri: string): FakePlayer => {
    const player: FakePlayer = {
      uri,
      playCalls: 0,
      pauseCalls: 0,
      removeCalls: 0,
      loop: false,
      volume: 1,
      play() {
        player.playCalls += 1;
      },
      pause() {
        player.pauseCalls += 1;
      },
      remove() {
        player.removeCalls += 1;
      },
    };
    players.push(player);
    return player;
  };
  return { factory, players };
};

const makeCtx = (): BridgeAudioContext => ({
  sampleRate: NATIVE_SAMPLE_RATE,
  currentTime: 0,
  state: 'running',
  resume: async () => {},
  suspend: async () => {},
  close: async () => {},
});

const makeSinkNode = (): BridgeAudioNode => ({ kind: 'sink', disconnect: () => {} });

const sine = (frequency: number, sampleRate: number, length: number): Float32Array => {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
};

const peak = (samples: Float32Array): number => {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i] ?? 0));
  return max;
};

describe('NativePlatformBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advertises the native platform and PCM support', () => {
    const bridge = new NativePlatformBridge({ createPlayer: makePlayerFactory().factory });
    expect(bridge.platform).toBe('native');
    expect(typeof bridge.createPcmSource).toBe('function');
  });

  it('creates a context at the native voice sample rate', async () => {
    const bridge = new NativePlatformBridge({ createPlayer: makePlayerFactory().factory });
    const ctx = await bridge.createContext();
    expect(ctx.sampleRate).toBe(NATIVE_SAMPLE_RATE);
    expect(ctx.state).toBe('running');

    await ctx.suspend();
    expect(ctx.state).toBe('suspended');
    await ctx.resume();
    expect(ctx.state).toBe('running');
    await ctx.close();
    expect(ctx.state).toBe('closed');
  });

  it('plays a PCM source as a WAV data URI', () => {
    const { factory, players } = makePlayerFactory();
    const bridge = new NativePlatformBridge({ createPlayer: factory });
    const ctx = makeCtx();

    const source = bridge.createPcmSource(
      ctx,
      sine(220, NATIVE_SAMPLE_RATE, 4800),
      NATIVE_SAMPLE_RATE,
    );
    source.start();

    expect(players).toHaveLength(1);
    const player = players[0];
    expect(player?.uri.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(player?.playCalls).toBe(1);
    expect(player?.volume).toBe(1);

    source.stop();
    expect(player?.pauseCalls).toBe(1);
    source.disconnect();
    expect(player?.removeCalls).toBe(1);
  });

  it('renders the connected VoiceProcessor-style chain before playback', () => {
    const { factory, players } = makePlayerFactory();
    const bridge = new NativePlatformBridge({ createPlayer: factory });
    const ctx = makeCtx();
    const destination = bridge.createMasterGain(ctx);

    const eq = bridge.createBiquad(ctx, 'bandpass');
    eq.setFrequency(1800);
    eq.setQ(0.8);
    const shaper = bridge.createWaveShaper(ctx);
    shaper.setCurve(makeBitcrushCurve(0.05));
    const output = bridge.createMasterGain(ctx);
    output.setGain(0.5);

    bridge.connect(eq, shaper);
    bridge.connect(shaper, output);
    bridge.connect(output, destination);

    const samples = sine(1800, NATIVE_SAMPLE_RATE, 4800);
    const source = bridge.createPcmSource(ctx, samples, NATIVE_SAMPLE_RATE);
    bridge.connect(source, eq);
    source.start();

    // A rendered buffer reached the player: the data URI is far longer than the
    // bare 44-byte WAV header, and the chain's 0.5 output gain halves the peak.
    const uri = players[0]?.uri ?? '';
    const base64 = uri.slice(uri.indexOf(',') + 1);
    const decoded = Buffer.from(base64, 'base64');
    expect(decoded.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(decoded.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(decoded.readUInt16LE(22)).toBe(1); // mono
    expect(decoded.readUInt32LE(24)).toBe(NATIVE_SAMPLE_RATE);
    expect(decoded.readUInt16LE(34)).toBe(16); // 16-bit

    const pcm = new Int16Array(decoded.buffer, decoded.byteOffset + 44, (decoded.length - 44) / 2);
    expect(pcm.length).toBe(samples.length);
    expect(peak(Float32Array.from(pcm, (value) => value / 32767))).toBeLessThan(
      peak(samples) * 0.75,
    );
  });

  it('does not create a player for an empty buffer', () => {
    const { factory, players } = makePlayerFactory();
    const bridge = new NativePlatformBridge({ createPlayer: factory });
    const source = bridge.createPcmSource(makeCtx(), new Float32Array(0), NATIVE_SAMPLE_RATE);
    source.start();
    expect(players).toHaveLength(0);
  });

  it('is idempotent across repeated start/stop/disconnect', () => {
    const { factory, players } = makePlayerFactory();
    const bridge = new NativePlatformBridge({ createPlayer: factory });
    const source = bridge.createPcmSource(
      makeCtx(),
      sine(220, NATIVE_SAMPLE_RATE, 2400),
      NATIVE_SAMPLE_RATE,
    );

    source.start();
    source.start();
    expect(players).toHaveLength(1);

    source.stop();
    source.stop();
    source.disconnect();
    source.disconnect();
    expect(players[0]?.pauseCalls).toBe(1);
    expect(players[0]?.removeCalls).toBe(1);
  });

  it('applies looping to the player', () => {
    const { factory, players } = makePlayerFactory();
    const bridge = new NativePlatformBridge({ createPlayer: factory });
    const source = bridge.createPcmSource(
      makeCtx(),
      sine(220, NATIVE_SAMPLE_RATE, 2400),
      NATIVE_SAMPLE_RATE,
    );

    source.setLoop(true);
    source.start();
    expect(players[0]?.loop).toBe(true);
  });

  it('plays through expo-audio by default', () => {
    const player = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      loop: false,
      volume: 1,
    };
    (createAudioPlayer as jest.Mock).mockReturnValueOnce(player);

    const bridge = new NativePlatformBridge();
    const source = bridge.createPcmSource(
      makeCtx(),
      sine(220, NATIVE_SAMPLE_RATE, 480),
      NATIVE_SAMPLE_RATE,
    );
    source.start();

    expect(createAudioPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ uri: expect.stringMatching(/^data:audio\/wav;base64,/) }),
    );
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.volume).toBe(1);

    source.disconnect();
    expect(player.remove).toHaveBeenCalledTimes(1);
  });

  it('rejects operations outside the native PCM path', async () => {
    const bridge = new NativePlatformBridge({ createPlayer: makePlayerFactory().factory });
    const ctx = makeCtx();
    expect(() => bridge.createStaticSource(ctx, 'white')).toThrow(NativeAudioUnsupportedError);
    expect(() => bridge.createConvolver(ctx)).toThrow(NativeAudioUnsupportedError);
    expect(() => bridge.createReverbBuffer(ctx, 2, 2)).toThrow(NativeAudioUnsupportedError);
    expect(() => bridge.createNoiseBuffer(ctx, 'white', 2)).toThrow(NativeAudioUnsupportedError);
    await expect(bridge.decodeAudio(ctx, new ArrayBuffer(0))).rejects.toThrow(
      NativeAudioUnsupportedError,
    );
    expect(() => bridge.connect(makeSinkNode(), bridge.createMasterGain(ctx))).toThrow(
      NativeAudioUnsupportedError,
    );
  });
});
