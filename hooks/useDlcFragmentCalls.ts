import { useEffect } from 'react';
import { refreshExpansionCalls } from '@/engine/calls/callManagerInstance';
import { useStoreStore } from '@/store/useStoreStore';

export function useDlcFragmentCalls(): void {
  const hasInfiniteSignal = useStoreStore((s) => s.hasInfiniteSignal);
  const ownedTapePacks = useStoreStore((s) => s.ownedTapePacks);

  useEffect(() => {
    refreshExpansionCalls(hasInfiniteSignal, ownedTapePacks);
  }, [hasInfiniteSignal, ownedTapePacks]);
}
