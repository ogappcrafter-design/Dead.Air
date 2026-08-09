import { CALL_TYPES } from '../content/callTypes';

import JustListen from './JustListen';
import DeadAir from './DeadAir';
import RightAnswer from './RightAnswer';
import SignalDecode from './SignalDecode';
import StayCalm from './StayCalm';

/**
 * Call type → player. CallScreen looks the component up here rather than
 * running five conditional renders, so adding a sixth type is one entry.
 */
export const CALL_PLAYERS = {
  [CALL_TYPES.JUST_LISTEN]: JustListen,
  [CALL_TYPES.DEAD_AIR]: DeadAir,
  [CALL_TYPES.RIGHT_ANSWER]: RightAnswer,
  [CALL_TYPES.SIGNAL_DECODE]: SignalDecode,
  [CALL_TYPES.STAY_CALM]: StayCalm,
};

export const playerFor = (type) => CALL_PLAYERS[type] || JustListen;
