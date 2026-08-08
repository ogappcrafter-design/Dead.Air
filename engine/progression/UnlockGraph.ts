// engine/progression/UnlockGraph.ts
// DEA-62: Pure unlock graph helpers consumed by InfiniteSignal.getCallPool.
//
// All functions are pure: callers pass `received` as an array of call ids
// already received and walk the graph. No I/O, no React, no Zustand. The
// engine layer must not import store modules; the runtime composes them.

import {
  UNLOCK_GRAPH,
  SACRED_CALL_COUNT,
  UnlockGraph as UnlockGraphType,
} from '../../data/unlockGraph';

/**
 * True when every prerequisite for `callId` is present in `received`.
 * Calls with no entry in the graph are unlocked by default (caller 0).
 */
export function isCallUnlocked(
  callId: number,
  received: readonly number[],
  graph: UnlockGraphType = UNLOCK_GRAPH,
): boolean {
  const prereqs = graph.prerequisites[callId];
  if (!prereqs || prereqs.length === 0) return true;
  const set = new Set(received);
  return prereqs.every((p) => set.has(p));
}

/**
 * Return all call ids (0..SACRED_CALL_COUNT-1) whose prerequisites are satisfied.
 */
export function getUnlockedCalls(
  received: readonly number[],
  graph: UnlockGraphType = UNLOCK_GRAPH,
): number[] {
  const unlocked: number[] = [];
  for (let id = 0; id < SACRED_CALL_COUNT; id++) {
    if (isCallUnlocked(id, received, graph)) {
      unlocked.push(id);
    }
  }
  return unlocked;
}

/**
 * Return call ids that are not yet unlocked but have at least one unsatisfied,
 * "reachable" prerequisite — i.e. calls one hop away from being unlocked.
 */
export function getNextUnlocks(
  received: readonly number[],
  graph: UnlockGraphType = UNLOCK_GRAPH,
): number[] {
  const set = new Set(received);
  const next: number[] = [];
  for (let id = 0; id < SACRED_CALL_COUNT; id++) {
    if (set.has(id)) continue;
    const prereqs = graph.prerequisites[id];
    if (!prereqs || prereqs.length === 0) continue; // already unlocked
    const remaining = prereqs.filter((p) => !set.has(p));
    if (remaining.length > 0) continue; // still blocked
    next.push(id);
  }
  return next;
}

/**
 * DFS-based cycle detector for the static graph. Returns true if a cycle
 * would make any call unreachable from the no-prerequisites frontier.
 * Mainly used at test time; the shipped UNLOCK_GRAPH is acyclic.
 */
export function hasCycle(graph: UnlockGraphType = UNLOCK_GRAPH): boolean {
  const WHITE = 0; // unvisited
  const GRAY = 1; // on current DFS stack
  const BLACK = 2; // finished
  const color = new Map<number, number>();
  const ids = new Set<number>();
  for (const k of Object.keys(graph.prerequisites)) {
    const id = Number(k);
    ids.add(id);
    for (const p of graph.prerequisites[id] ?? []) {
      ids.add(p);
    }
  }
  for (const id of ids) color.set(id, WHITE);

  const dfs = (id: number): boolean => {
    const c = color.get(id) ?? WHITE;
    if (c === GRAY) return true; // back edge
    if (c === BLACK) return false;
    color.set(id, GRAY);
    for (const p of graph.prerequisites[id] ?? []) {
      if (dfs(p)) return true;
    }
    color.set(id, BLACK);
    return false;
  };

  for (const id of ids) {
    if ((color.get(id) ?? WHITE) === WHITE && dfs(id)) {
      return true;
    }
  }
  return false;
}
