import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'react-native';

import BootScreen from './src/screens/BootScreen';
import CallScreen from './src/screens/CallScreen';
import DialScreen from './src/screens/DialScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SignOffScreen from './src/screens/SignOffScreen';
import StoreScreen from './src/screens/StoreScreen';

import { bandById } from './src/content/bands';
import { applyCallResult, DEFAULT_SAVE, migratePurchases, migrateSave } from './src/engine/save';
import { defaultBandId, generationStatus } from './src/engine/progression';
import { applyEntitlements, purchase, restore } from './src/services/billing';
import { generateCall } from './src/services/signal';
import { PURCHASE_KEY, SAVE_KEY, readJson, writeJson } from './src/services/storage';

/**
 * Root. Holds the save, the purchases, and which screen is up.
 *
 * A plain screen enum rather than a navigation library: five screens, no deep
 * links, no URL bar — and it keeps the app's runtime dependency list identical
 * to v1's, so the existing EAS build config still applies.
 */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState(DEFAULT_SAVE);
  const [purchases, setPurchases] = useState(migratePurchases(null));

  const [screen, setScreen] = useState('dial');
  const [activeCall, setActiveCall] = useState(null);
  const [signOff, setSignOff] = useState(null);
  const [activeBandId, setActiveBandId] = useState(0);

  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeError, setStoreError] = useState(null);

  // Boot: load and migrate before the first real frame renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rawSave, rawPurchases] = await Promise.all([
        readJson(SAVE_KEY),
        readJson(PURCHASE_KEY),
      ]);
      if (cancelled) return;

      const migrated = migrateSave(rawSave);
      const owned = migratePurchases(rawPurchases);
      setSave(migrated);
      setPurchases(owned);
      setActiveBandId(defaultBandId(migrated, owned));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSave = useCallback(async (next) => {
    setSave(next);
    await writeJson(SAVE_KEY, next);
  }, []);

  const persistPurchases = useCallback(async (next) => {
    setPurchases(next);
    await writeJson(PURCHASE_KEY, next);
  }, []);

  const handleCallComplete = useCallback(
    async (result) => {
      const call = activeCall;
      const { save: next, gained } = applyCallResult(save, call, result);
      setActiveCall(null);
      setSignOff({ call, gained });
      setScreen('signoff');
      await persistSave(next);
    },
    [activeCall, save, persistSave],
  );

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    if (!generationStatus(save, purchases).allowed) return;

    setGenerating(true);
    setGenerationError(null);
    try {
      const call = await generateCall(bandById(activeBandId));
      setActiveCall(call);
      setScreen('call');
    } catch (err) {
      setGenerationError(err?.message || 'SIGNAL LOST');
    } finally {
      setGenerating(false);
    }
  }, [activeBandId, generating, purchases, save]);

  const handleBuy = useCallback(
    async (productId) => {
      setStoreBusy(true);
      setStoreError(null);
      try {
        const { granted } = await purchase(productId);
        await persistPurchases(applyEntitlements(purchases, granted));
        setScreen('dial');
      } catch (err) {
        setStoreError(err?.message || 'PURCHASE FAILED');
      } finally {
        setStoreBusy(false);
      }
    },
    [purchases, persistPurchases],
  );

  const handleRestore = useCallback(async () => {
    setStoreBusy(true);
    setStoreError(null);
    try {
      const { granted } = await restore();
      if (granted.length === 0) {
        setStoreError('NOTHING TO RESTORE');
      } else {
        await persistPurchases(applyEntitlements(purchases, granted));
      }
    } catch (err) {
      setStoreError(err?.message || 'RESTORE FAILED');
    } finally {
      setStoreBusy(false);
    }
  }, [purchases, persistPurchases]);

  const handleErase = useCallback(async () => {
    // Purchases deliberately survive an erase — entitlements are not progress.
    const fresh = { ...DEFAULT_SAVE };
    await persistSave(fresh);
    setActiveBandId(defaultBandId(fresh, purchases));
    setScreen('dial');
  }, [purchases, persistSave]);

  const dial = useMemo(
    () => (
      <DialScreen
        save={save}
        purchases={purchases}
        activeBandId={activeBandId}
        generating={generating}
        generationError={generationError}
        onSelectBand={setActiveBandId}
        onStartCall={(call) => {
          setActiveCall(call);
          setScreen('call');
        }}
        onGenerate={handleGenerate}
        onOpenStore={() => {
          setStoreError(null);
          setScreen('store');
        }}
        onOpenSettings={() => setScreen('settings')}
      />
    ),
    [save, purchases, activeBandId, generating, generationError, handleGenerate],
  );

  if (!loaded) return <BootScreen />;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#030303" />
      {screen === 'call' && activeCall ? (
        <CallScreen call={activeCall} onComplete={handleCallComplete} />
      ) : screen === 'signoff' && signOff ? (
        <SignOffScreen
          call={signOff.call}
          gained={signOff.gained}
          onDismiss={() => {
            setSignOff(null);
            setScreen('dial');
          }}
        />
      ) : screen === 'store' ? (
        <StoreScreen
          purchases={purchases}
          busy={storeBusy}
          error={storeError}
          onBuy={handleBuy}
          onRestore={handleRestore}
          onClose={() => setScreen('dial')}
        />
      ) : screen === 'settings' ? (
        <SettingsScreen
          save={save}
          purchases={purchases}
          onErase={handleErase}
          onClose={() => setScreen('dial')}
        />
      ) : (
        dial
      )}
    </>
  );
}
