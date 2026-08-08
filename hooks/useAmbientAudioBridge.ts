// hooks/useAmbientAudioBridge.ts
// Bridges useAmbientStore.activeAmbient → AudioEngine ambient profile.
// When the user selects an atmospheric pack in settings, this hook
// applies the corresponding AmbientProfile to the AudioEngine's
// AmbientLayer. If the engine isn't ready yet, the profile is stored
// as pending and applied once the layer is attached.

import { useEffect } from 'react';
import { useAmbientStore } from '@/store/useAmbientStore';
import { getAtmosphericPack, DEFAULT_PACK_ID } from '@/data/atmosphericPacks';
import { getAudioEngine } from '@/engine/audio/AudioEngine';
import { AmbientLayer } from '@/engine/audio/AmbientLayer';
import { createWebAudioBridge } from '@/engine/audio/WebAudioBridge';
import type { AmbientProfile } from '@/engine/audio/profiles/types';

/**
 * Watches the active ambient selection and wires it to the AudioEngine.
 * Call this hook once in the component that owns the AudioEngine
 * lifecycle (app/tapes/index.tsx).
 */
export function useAmbientAudioBridge(): void {
  const activeAmbient = useAmbientStore((s) => s.activeAmbient);

  useEffect(() => {
    const engine = getAudioEngine();
    if (engine === null) {
      return;
    }

    // Ensure an AmbientLayer is attached to the engine.
    if (engine.getAmbientLayer() === null) {
      const bridge = createWebAudioBridge();
      const ctx = engine.getContext();
      const master = engine.getMasterGain();
      if (ctx !== null && master !== null) {
        const layer = new AmbientLayer(bridge, ctx, master);
        engine.setAmbientLayer(layer);
      }
    }

    // Map activeAmbient → AmbientProfile (null for 'default').
    let profile: AmbientProfile | null = null;
    if (activeAmbient !== DEFAULT_PACK_ID) {
      const pack = getAtmosphericPack(activeAmbient);
      if (pack !== undefined) {
        profile = pack.ambientProfile;
      }
    }

    engine.setAmbientProfile(profile);
  }, [activeAmbient]);
}
