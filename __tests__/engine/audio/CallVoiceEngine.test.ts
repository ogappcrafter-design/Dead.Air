// __tests__/engine/audio/CallVoiceEngine.test.ts
import { CallVoiceEngine, DEFAULT_LINE_WINDOW_MS } from '../../../engine/audio/CallVoiceEngine';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';
import type { BridgeAudioContext, BridgeAudioNode } from '../../../engine/audio/PlatformBridge';
import { voiceProfileFor } from '../../../engine/audio/tts/VoiceProfile';

const profile = voiceProfileFor({ id: 3, callerId: 'TEST-3', band: 0, signal: 5 }, { sanity: 100 });

const makeCtx = (): BridgeAudioContext => ({
  sampleRate: 22050,
  currentTime: 0,
  state: 'running',
  resume: async () => {},
  suspend: async () => {},
  close: async () => {},
});

const makeSink = (): BridgeAudioNode => ({ kind: 'sink', disconnect: () => {} });

describe('CallVoiceEngine', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports unsupported when the bridge cannot play PCM', () => {
    const bridge = makeMockBridge();
    delete (bridge as { createPcmSource?: unknown }).createPcmSource;
    const engine = new CallVoiceEngine({
      bridge,
      ctx: makeCtx(),
      destination: makeSink(),
    });
    expect(engine.isSupported()).toBe(false);
    expect(engine.renderLine('hello', profile)).toBeNull();
  });

  it('renders and caches a line', () => {
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });

    const first = engine.renderLine('the signal is forming', profile);
    const second = engine.renderLine('the signal is forming', profile);

    expect(first).not.toBeNull();
    expect(first?.samples.length).toBeGreaterThan(0);
    expect(second).toBe(first);
    expect(engine.getStats().renderedLines).toBe(1);
    expect(engine.getStats().cacheHits).toBe(1);
  });

  it('refuses empty and overlong lines', () => {
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });
    expect(engine.renderLine('   ', profile)).toBeNull();
    expect(engine.renderLine('x'.repeat(401), profile)).toBeNull();
  });

  it('bounds the cache', () => {
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({
      bridge,
      ctx: makeCtx(),
      destination: makeSink(),
      cacheSize: 2,
    });
    engine.renderLine('one', profile);
    engine.renderLine('two', profile);
    engine.renderLine('three', profile);
    expect(engine.getStats().cachedLines).toBe(2);
  });

  it('plays a line through the bridge and resolves when it finishes', async () => {
    jest.useFakeTimers();
    const bridge = makeMockBridge();
    const ctx = makeCtx();
    const destination = makeSink();
    const engine = new CallVoiceEngine({ bridge, ctx, destination });

    const promise = engine.speakLine('hi', profile, 500);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe(true);
    expect(bridge.createPcmSource).toHaveBeenCalledTimes(1);
    expect(bridge.connect).toHaveBeenCalledWith(expect.anything(), destination);
    expect(engine.getStats().playedLines).toBe(1);
  });

  it('speaks every line and pre-warms the next one', async () => {
    jest.useFakeTimers();
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });

    const promise = engine.speak(['one', 'two'], profile, {
      lineDurationMs: DEFAULT_LINE_WINDOW_MS,
    });
    await jest.advanceTimersByTimeAsync(DEFAULT_LINE_WINDOW_MS * 3);

    await expect(promise).resolves.toBeUndefined();
    expect(engine.getStats().playedLines).toBe(2);
    // Line 2 was pre-warmed before it played, so only two renders happened.
    expect(engine.getStats().renderedLines).toBe(2);
    expect(engine.getStats().cacheHits).toBeGreaterThanOrEqual(1);
  });

  it('stop() cancels an in-flight line', async () => {
    jest.useFakeTimers();
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });

    const promise = engine.speakLine('a long line of dialogue', profile, 2000);
    await Promise.resolve();
    engine.stop();
    await jest.advanceTimersByTimeAsync(3000);

    await expect(promise).resolves.toBe(false);
  });

  it('ignores speak after dispose', async () => {
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });
    engine.dispose();
    await expect(engine.speak(['hello'], profile)).resolves.toBeUndefined();
    expect(engine.getStats().playedLines).toBe(0);
  });

  it('uses a per-line profile for multi-caller lines', async () => {
    jest.useFakeTimers();
    const bridge = makeMockBridge();
    const engine = new CallVoiceEngine({ bridge, ctx: makeCtx(), destination: makeSink() });

    const second = voiceProfileFor(
      { id: 3, callerId: 'TEST-3', band: 0, signal: 5 },
      { sanity: 100, speakerIndex: 1 },
    );

    const promise = engine.speak(['hello', 'again'], profile, {
      lineDurationMs: 1000,
      profileForLine: (index) => (index === 1 ? second : profile),
    });
    await jest.advanceTimersByTimeAsync(4000);
    await expect(promise).resolves.toBeUndefined();

    expect(engine.getStats().playedLines).toBe(2);
  });
});
