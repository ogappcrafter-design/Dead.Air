import fs from 'fs';
import path from 'path';

import { ASSETS } from '../src/audio/assets';
import { AUDIO_MODE, CARRIER, SOUNDS, SOUND_NAMES } from '../src/audio/manifest';
import { DEFAULT_SETTINGS, migrateSettings } from '../src/engine/settings';

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
  it('defaults sound on', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings({}).sound).toBe(true);
    expect(migrateSettings('junk').sound).toBe(true);
  });

  it('remembers an explicit opt-out', () => {
    expect(migrateSettings({ sound: false }).sound).toBe(false);
  });

  it('treats anything unreadable as on rather than leaving a player muted', () => {
    expect(migrateSettings({ sound: 'no' }).sound).toBe(true);
    expect(migrateSettings({ sound: undefined }).sound).toBe(true);
  });
});
