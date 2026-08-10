import fs from 'fs';
import path from 'path';

import { ASSETS } from '../src/audio/assets';
import { AUDIO_MODE, CARRIER, SOUNDS, SOUND_NAMES } from '../src/audio/manifest';
import { DEFAULT_SETTINGS, migrateSettings } from '../src/engine/settings';
import { IMPACT, NOTIFICATION, PATTERNS, PATTERN_NAMES, SELECTION } from '../src/haptics/patterns';

const AUDIO_DIR = path.join(__dirname, '..', 'assets', 'audio');

describe('the sound set', () => {
  it('stays small — sound marks moments, it does not upholster the UI', () => {
    expect(SOUND_NAMES.length).toBeLessThanOrEqual(10);
  });

  it('gives every sound a sane volume', () => {
    SOUND_NAMES.forEach((name) => {
      const { volume } = SOUNDS[name];
      expect(volume).toBeGreaterThan(0);
      expect(volume).toBeLessThanOrEqual(1);
    });
  });

  it('loops exactly one sound, and it is the station bed', () => {
    const looping = SOUND_NAMES.filter((n) => SOUNDS[n].loop);
    expect(looping).toEqual([CARRIER]);
  });

  it('keeps the bed under everything else', () => {
    const others = SOUND_NAMES.filter((n) => n !== CARRIER);
    others.forEach((name) => {
      expect(SOUNDS[CARRIER].volume).toBeLessThan(SOUNDS[name].volume);
    });
  });

  it('makes the archive bell the loudest thing in the mix', () => {
    const loudest = SOUND_NAMES.reduce((a, b) => (SOUNDS[a].volume >= SOUNDS[b].volume ? a : b));
    expect(loudest).toBe('tape');
  });
});

describe('assets', () => {
  // A typo in either map would otherwise only surface as silence on a device.
  it('has one asset per manifest entry and no strays', () => {
    expect(Object.keys(ASSETS).sort()).toEqual([...SOUND_NAMES].sort());
  });

  it('resolves every declared file on disk', () => {
    SOUND_NAMES.forEach((name) => {
      expect(fs.existsSync(path.join(AUDIO_DIR, SOUNDS[name].file))).toBe(true);
    });
  });

  it('ships no audio the manifest does not know about', () => {
    const onDisk = fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.wav'));
    const declared = SOUND_NAMES.map((n) => SOUNDS[n].file);
    expect(onDisk.sort()).toEqual(declared.sort());
  });

  it('stays within a reasonable bundle budget', () => {
    const bytes = fs
      .readdirSync(AUDIO_DIR)
      .filter((f) => f.endsWith('.wav'))
      .reduce((sum, f) => sum + fs.statSync(path.join(AUDIO_DIR, f)).size, 0);
    expect(bytes).toBeLessThan(1024 * 1024);
  });

  it('writes mono 16-bit PCM at one consistent rate', () => {
    SOUND_NAMES.forEach((name) => {
      const header = fs.readFileSync(path.join(AUDIO_DIR, SOUNDS[name].file)).subarray(0, 44);
      expect(header.toString('ascii', 0, 4)).toBe('RIFF');
      expect(header.toString('ascii', 8, 12)).toBe('WAVE');
      expect(header.readUInt16LE(22)).toBe(1); // channels
      expect(header.readUInt32LE(24)).toBe(32000); // sample rate
      expect(header.readUInt16LE(34)).toBe(16); // bit depth
    });
  });
});

describe('audio session policy', () => {
  it('honours the silent switch and does not interrupt other audio', () => {
    expect(AUDIO_MODE.playsInSilentMode).toBe(false);
    expect(AUDIO_MODE.shouldPlayInBackground).toBe(false);
    expect(AUDIO_MODE.interruptionMode).toBe('mixWithOthers');
  });
});

describe('migrateSettings', () => {
  it('defaults every channel on', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings({})).toEqual({ sound: true, haptics: true });
    expect(migrateSettings('junk')).toEqual(DEFAULT_SETTINGS);
  });

  it('remembers an explicit opt-out, per channel', () => {
    expect(migrateSettings({ sound: false })).toEqual({ sound: false, haptics: true });
    expect(migrateSettings({ haptics: false })).toEqual({ sound: true, haptics: false });
  });

  it('treats anything unreadable as on rather than leaving a player without feedback', () => {
    expect(migrateSettings({ sound: 'no', haptics: 0 })).toEqual({ sound: true, haptics: true });
    expect(migrateSettings({ sound: undefined })).toEqual(DEFAULT_SETTINGS);
  });

  it('carries a save written before haptics existed', () => {
    // A v1 settings file only had `sound`.
    expect(migrateSettings({ sound: false })).toHaveProperty('haptics', true);
  });
});

describe('haptics', () => {
  it('covers every one-shot sound, and nothing that loops', () => {
    // Sound and touch fire on the same moments; a new one-shot without a
    // matching pattern would be silently half-wired.
    const oneShots = SOUND_NAMES.filter((n) => !SOUNDS[n].loop).sort();
    expect([...PATTERN_NAMES].sort()).toEqual(oneShots);
    expect(PATTERN_NAMES).not.toContain(CARRIER);
  });

  it('uses a kind every platform mapping knows', () => {
    PATTERN_NAMES.forEach((name) => {
      expect([IMPACT, NOTIFICATION, SELECTION]).toContain(PATTERNS[name].kind);
    });
  });

  it('gives impacts and notifications a style, and selection none', () => {
    PATTERN_NAMES.forEach((name) => {
      const { kind, style } = PATTERNS[name];
      if (kind === SELECTION) expect(style).toBeUndefined();
      else expect(typeof style).toBe('string');
    });
  });

  it('reserves the success note for the archive and the warning for a refusal', () => {
    const notifications = PATTERN_NAMES.filter((n) => PATTERNS[n].kind === NOTIFICATION);
    expect(notifications.sort()).toEqual(['reject', 'tape']);
    expect(PATTERNS.tape.style).toBe('success');
    expect(PATTERNS.reject.style).toBe('warning');
  });

  it('keeps everything else light, so nothing outshouts the reward', () => {
    ['key', 'hangup', 'breath'].forEach((name) => expect(PATTERNS[name].style).toBe('light'));
  });
});
