import { useEffect } from 'react';
import { refreshExpansionCalls } from '@/engine/calls/callManagerInstance';
import { useStoreStore } from '@/store/useStoreStore';

export function useDlcFragmentCalls(): void {
  const ownedTapePacks = useStoreStore((s) => s.ownedTapePacks);

  useEffect(() => {
    refreshExpansionCalls(ownedTapePacks);
  }, [ownedTapePacks]);
}
