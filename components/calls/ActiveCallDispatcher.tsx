import React, { useCallback, useEffect, useState } from 'react';
import { callManager } from '@/engine/calls/callManagerInstance';
import type { CallTypeRoute } from '@/engine/calls/CallManager';
import type { ActiveCall, CallLifecycleState, CallOutcome } from '@/engine/calls/types';
import { JustListenCall } from '@/components/calls/JustListenCall';
import { RightAnswerCall } from '@/components/calls/RightAnswerCall';
import { DeadAirCall } from '@/components/calls/DeadAirCall';
import StayCalmCall from '@/components/calls/StayCalmCall';
import { SignalDecodeCall } from '@/components/calls/SignalDecodeCall';
import { RecordingCall } from '@/components/calls/RecordingCall';
import { MultiCallerCall } from '@/components/calls/MultiCallerCall';
import { TimingCall } from '@/components/calls/TimingCall';
import { PuzzleCall } from '@/components/calls/PuzzleCall';
import { ConversationCall } from '@/components/calls/ConversationCall';
import { SanityOverlay } from './SanityOverlay';
import { useSanityEffect } from '../../hooks/useSanityEffect';

export function ActiveCallDispatcher() {
  // SanityEffect drives the visual overlay during active calls; it derives
  // its target from the game store internally, so no argument is needed.
  const sanityEffect = useSanityEffect();
  const [route, setRoute] = useState<CallTypeRoute | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    return callManager.subscribe((state: CallLifecycleState, call: ActiveCall | null) => {
      setRoute(callManager.getActiveRoute());
      setActiveCall(call);
    });
  }, []);

  // Hooks must be called unconditionally and before any early return;
  // declaring onComplete here keeps the hook order stable across renders
  // where route/activeCall flip between null and a real call.
  const onComplete = useCallback((outcome: CallOutcome) => callManager.endCall(outcome), []);

  if (!route || !activeCall) return null;

  switch (route) {
    case 'JUST_LISTEN':
      return <JustListenCall call={activeCall.call} onComplete={onComplete} />;
    case 'RIGHT_ANSWER':
      return <RightAnswerCall call={activeCall.call} onComplete={onComplete} />;
    case 'DEAD_AIR':
      return <DeadAirCall call={activeCall.call} onComplete={onComplete} />;
    case 'STAY_CALM':
      return <StayCalmCall call={activeCall.call} onComplete={onComplete} />;
    case 'SIGNAL_DECODE':
      return <SignalDecodeCall call={activeCall.call} onComplete={onComplete} />;
    case 'RECORDING':
      return <RecordingCall call={activeCall.call} onComplete={onComplete} />;
    case 'MULTI_CALLER':
      return <MultiCallerCall call={activeCall.call} onComplete={onComplete} />;
    case 'TIMING':
      return <TimingCall call={activeCall.call} onComplete={onComplete} />;
    case 'PUZZLE':
      return <PuzzleCall call={activeCall.call} onComplete={onComplete} />;
    case 'CONVERSATION':
      return <ConversationCall call={activeCall.call} onComplete={onComplete} />;
    default:
      return null;
  }
}
