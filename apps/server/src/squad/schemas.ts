// zod schemas for every REST body and socket payload (GDD §11.29). Unknown keys are stripped;
// anything that fails to parse is answered with 'bad-request' and never reaches session state.

import { z } from 'zod';
import {
  BECAUSE_TILES,
  GUARDIANS,
  REASON_CHIPS,
  SEAT_TOKEN_RE,
  SESSION_OPTION_KEYS,
  SQUAD_MISSION_PHASES,
  SQUAD_TOTEMS,
  type BecauseTileId,
  type GuardianId,
  type ReasonChipId,
  type SquadTotemId,
} from '@shieldquest/shared';

const ids = <T extends string>(list: readonly { id: T }[]) => list.map((x) => x.id) as [T, ...T[]];

/** Content ids (missions, clues, choices, tiles, aftershock keys): short and boring. */
const contentId = z.string().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/);
const clientId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
const player = z.number().int().min(0).max(7).optional();
const squadId = z.enum(ids<SquadTotemId>(SQUAD_TOTEMS));
const guardianId = z.enum(ids<GuardianId>(GUARDIANS));
const chipId = z.enum(ids<ReasonChipId>(REASON_CHIPS));
const becauseId = z.enum(ids<BecauseTileId>(BECAUSE_TILES));
const bandId = z.enum(['junior', 'teen', 'young-adult']);
const phase = z.enum(SQUAD_MISSION_PHASES);
const roomCode = z.string().min(4).max(16);

export const CreateSessionBody = z.object({
  band: bandId,
  missionIds: z.array(contentId).min(1).max(3),
  squadCount: z.number().int().min(2).max(6).optional(),
  gentle: z.boolean().optional(),
  discreet: z.boolean().optional(),
  calm: z.boolean().optional(),
  relaxed: z.boolean().optional(),
  autoAdvance: z.boolean().optional(),
});

export const CodeParams = z.object({ code: roomCode });

export const HandshakeAuthSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('host'), code: roomCode, hostKey: z.string().min(16).max(64) }),
  z.object({ role: z.literal('screen'), code: roomCode }),
  z.object({
    role: z.literal('seat'),
    code: roomCode,
    seatToken: z.string().regex(SEAT_TOKEN_RE),
    squad: squadId.optional(),
    reclaimSeatId: z.string().min(4).max(32).optional(),
  }),
  z.object({ role: z.literal('probe') }),
]);

export const EmptySchema = z.object({}).optional();
export const OnSchema = z.object({ on: z.boolean() });

export const SeatSchemas = {
  hold: z.object({ missionId: contentId, atSec: z.number().finite().min(0).max(3600) }),
  pin: z.object({ clueId: contentId, live: z.boolean(), fine: z.boolean().optional() }),
  unpin: z.object({ clueId: contentId }),
  trace: z.object({ optionId: contentId, player }),
  forecast: z.object({ optionId: contentId, player }),
  seal: z.object({
    voteId: clientId,
    round: z.union([z.literal(1), z.literal(2)]),
    choiceId: contentId,
    confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    player,
  }),
  reasons: z.object({ chips: z.array(chipId).max(2), player }),
  tiebreak: z.object({ choiceId: contentId, because: becauseId }),
  shieldTile: z.object({ slot: z.enum(['opener', 'reason', 'offer', 'channel']), tileId: contentId }),
  shieldSend: EmptySchema,
  shieldRetry: EmptySchema,
  share: OnSchema,
  guardian: z.object({ guardian: guardianId }),
  extendExplain: EmptySchema,
  ready: z.object({ phase, on: z.boolean().optional() }),
  needHelp: OnSchema,
  takeBreak: OnSchema,
  roomHold: OnSchema,
  lateHold: z.object({ key: contentId, optionId: contentId, player }),
  signal: z.object({ kind: z.literal('see-differently') }),
  dashAnswer: z.object({ questionId: contentId, optionId: contentId, player }),
} as const;

export type SeatEventName = keyof typeof SeatSchemas;

export const HostCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startRoomFreeze') }),
  z.object({ type: z.literal('endRoomFreeze') }),
  z.object({ type: z.literal('startMission'), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal('next'), squadId: squadId.optional() }),
  z.object({ type: z.literal('setPhase'), phase, squadId: squadId.optional() }),
  z.object({ type: z.literal('extend'), squadId: squadId.optional(), sec: z.number().int().min(5).max(300).optional() }),
  z.object({ type: z.literal('endMission') }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('setOption'), key: z.enum(SESSION_OPTION_KEYS), value: z.boolean() }),
  z.object({ type: z.literal('squadGentle'), squadId, on: z.boolean() }),
  z.object({ type: z.literal('lockJoins'), locked: z.boolean() }),
  z.object({ type: z.literal('moveSeat'), seatId: z.string().min(4).max(32), squadId }),
  z.object({ type: z.literal('setSeatPlayers'), seatId: z.string().min(4).max(32), players: z.number().int().min(1).max(6) }),
  z.object({ type: z.literal('removeSeat'), seatId: z.string().min(4).max(32) }),
  z.object({ type: z.literal('addSquad') }),
  z.object({ type: z.literal('balanceSquads') }),
  z.object({ type: z.literal('clearHelp'), squadId: squadId.optional() }),
  z.object({ type: z.literal('spotlight'), squadId: squadId.nullable() }),
  z.object({ type: z.literal('endSession') }),
  z.object({ type: z.literal('dashStart'), questions: z.union([z.literal(4), z.literal(6), z.literal(8)]) }),
  z.object({ type: z.literal('dashNext') }),
  z.object({ type: z.literal('dashSkip') }),
  z.object({ type: z.literal('dashEnd') }),
]);

export const ClockPingSchema = z.object({ c: z.number().finite() });
