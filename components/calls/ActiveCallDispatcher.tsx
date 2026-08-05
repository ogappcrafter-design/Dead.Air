import React, { useEffect, useState } from "react";
import { callManager } from "@/engine/calls/callManagerInstance";
import type { CallTypeRoute } from "@/engine/calls/CallManager";
import type { ActiveCall, CallLifecycleState, CallOutcome } from "@/engine/calls/types";
import { JustListenCall } from "@/components/calls/JustListenCall";
import { RightAnswerCall } from "@/components/calls/RightAnswerCall";
import { DeadAirCall } from "@/components/calls/DeadAirCall";

export function ActiveCallDispatcher() {
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
    default:
      return null;
  }
}
