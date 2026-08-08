import { useEffect, useCallback } from 'react';
import { useTutorialStore, type TutorialStep } from '@/store/useTutorialStore';
import { callManager } from '@/engine/calls/callManagerInstance';
import { TUTORIAL_CALL_IDS } from '@/data/tutorialCalls';

const STEP_TO_CALL_ID: Record<string, number> = {
  'call-1': TUTORIAL_CALL_IDS[0],
  'call-2': TUTORIAL_CALL_IDS[1],
  'call-3': TUTORIAL_CALL_IDS[2],
};

const STEP_AFTER: Record<string, TutorialStep> = {
  'call-1': 'call-2',
  'call-2': 'call-3',
  'call-3': 'transition',
};

export function useTutorialController() {
  const step = useTutorialStore((s) => s.step);
  const skipped = useTutorialStore((s) => s.skipped);
  const setStep = useTutorialStore((s) => s.setStep);
  const complete = useTutorialStore((s) => s.complete);

  const startTutorialCall = useCallback((callId: number) => {
    const mgr = callManager;
    if (mgr.getCallState() !== 'idle') return;
    mgr.startCall(callId);
  }, []);

  useEffect(() => {
    if (skipped || step === 'completed') return;

    if (step === 'not-started') {
      const timer = setTimeout(() => {
        setStep('call-1');
      }, 600);
      return () => clearTimeout(timer);
    }

    if (step === 'transition') {
      const timer = setTimeout(() => {
        complete();
      }, 4000);
      return () => clearTimeout(timer);
    }

    const callId = STEP_TO_CALL_ID[step];
    if (callId === undefined) return;

    const delay = step === 'call-1' ? 500 : 800;
    const timer = setTimeout(() => startTutorialCall(callId), delay);
    return () => clearTimeout(timer);
  }, [step, skipped, setStep, complete, startTutorialCall]);

  useEffect(() => {
    if (skipped || step === 'completed' || step === 'transition') return;

    const currentStep = step;
    const nextStep = STEP_AFTER[currentStep];
    if (nextStep === undefined) return;

    let prevState = callManager.getCallState();
    let transitionTimer: ReturnType<typeof setTimeout> | null = null;

    const unsub = callManager.subscribe((state) => {
      if (prevState === 'completed' && state === 'idle') {
        transitionTimer = setTimeout(() => setStep(nextStep), 300);
      }
      prevState = state;
    });

    return () => {
      if (transitionTimer !== null) {
        clearTimeout(transitionTimer);
      }
      unsub();
    };
  }, [step, skipped, setStep]);

  return {
    isActive: step !== 'completed' && step !== 'not-started' && !skipped,
    isInTransition: step === 'transition',
    isCompleted: step === 'completed' || skipped,
  };
}
