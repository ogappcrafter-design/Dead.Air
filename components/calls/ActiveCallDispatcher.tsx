import React, { useEffect, useState } from "react";
import { callManager } from "@/engine/calls/callManagerInstance";
import type { CallTypeRoute } from "@/engine/calls/CallManager";
import type { ActiveCall, CallLifecycleState, CallOutcome } from "@/engine/calls/types";
import { JustListenCall } from "@/components/calls/JustListenCall";
import { RightAnswerCall } from "@/components/calls/RightAnswerCall";
import { DeadAirCall } from "@/components/calls/DeadAirCall";
import StayCalmCall from "@/components/calls/StayCalmCall";
import { SignalDecodeCall } from "@/components/calls/SignalDecodeCall";
import { SanityOverlay } from './SanityOverlay';
import { useSanityEffect } from '../../hooks/useSanityEffect';

export function ActiveCallDispatcher() {
  // Sanity effect drives visual overlay during active calls.
  const sanityEffect = useSanityEffect(activeCall);
  const [route, setRoute] = useState<CallTypeRoute | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    return callManager.subscribe((state: CallLifecycleState, call: ActiveCall | null) => {
      setRoute(callManager.getActiveRoute());
      setActiveCall(call);
    });
  }, []);

  if (!route || !activeCall) return null;

  const onComplete = (outcome: CallOutcome) => callManager.endCall(outcome);

  switch (route) {
    case "JUST_LISTEN":
      return <JustListenCall call={activeCall.call} onComplete={onComplete} />;
    case "RIGHT_ANSWER":
      return <RightAnswerCall call={activeCall.call} onComplete={onComplete} />;
    case "DEAD_AIR":
      return <DeadAirCall call={activeCall.call} onComplete={onComplete} />;
    case "STAY_CALM":
      return <StayCalmCall call={activeCall.call} onComplete={onComplete} />;
    case "SIGNAL_DECODE":
      return <SignalDecodeCall call={activeCall.call} onComplete={onComplete} />;
    default:
      return null;
  }
}
