/**
 * DEA-95 Phase 1 — community server feature flag.
 *
 * The Worker keeps its own switch so a client build cannot enable the API by
 * itself. Both flags default to off.
 */

import { parseCommunityFlag } from '../../lib/community/featureFlag';
import type { CommunityEnv } from './types';

export function isCommunityEnabled(env: CommunityEnv): boolean {
  return parseCommunityFlag(env.COMMUNITY_ENABLED);
}
