import { describe, expect, it } from 'vitest';
import {
  MISSIONS,
  TACTICS,
  defaultSessionOptions,
  missionById,
  type DebriefView,
  type HostSnapshot,
  type MissionTimeline,
  type ScreenSnapshot,
  type ScreenSquad,
  type SessionPublic,
} from '@shieldquest/shared';
import {
  clock,
  flipBoard,
  lanternCount,
  liveSeconds,
  missionsForSession,
  nextAction,
  pacing,
  roleCard,
  scriptLine,
  squadExits,
  totemPath,
  unquote,
} from './logic';
import {
  debriefFrames,
  laneView,
  liveCaption,
  lookUpTeaser,
  mostMissedClue,
  roomDeadline,
  roomPhase,
  screenTrust,
  sessionMarkers,
  shieldLineText,
} from './screen/screenLogic';
import { debriefSteps } from './screen/Debrief';

const T0 = 1_700_000_000_000;
const mission = missionById('easy-money') ?? MISSIONS[0]!;

const timeline = (over: Partial<MissionTimeline> = {}): MissionTimeline => ({
  missionId: mission.id,
  index: 0,
  openedAt: T0,
  roleFlipAt: T0,
  liveAt: T0 + 15_000,
  liveEndsAt: T0 + 75_000,
  freezeEndAt: T0 + 225_000,
  surgeAt: null,
  ...over,
});

const session = (over: Partial<SessionPublic> = {}): SessionPublic => ({
  code: 'H7KQ2M',
  band: 'teen',
  phase: 'mission',
  missionIds: [mission.id],
  missionIndex: 0,
  missionComplete: false,
  acceptingJoins: true,
  options: defaultSessionOptions('teen'),
  paused: false,
  pausedAt: null,
  timeline: timeline(),
  roomFreeze: { active: false, done: true },
  joinPath: '/j/H7KQ2M',
  disclaimerRequired: true,
  ...over,
});

const squad = (over: Partial<ScreenSquad> = {}): ScreenSquad => ({
  id: 'hornbill',
  name: 'Hornbill',
  shape: 'triangle',
  connected: 5,
  phase: 'live',
  phaseEndsAt: null,
  complete: false,
  holding: 0,
  sealed: { count: 0, total: 5 },
  decided: false,
  guardians: [],
  trust: null,
  ...over,
});

describe('squad logic', () => {
  it('formats clocks and live seconds from the shared t0', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(75)).toBe('1:15');
    const tl = timeline();
    expect(liveSeconds(tl, T0 + 20_000, null, 60)).toBe(5);
    // Paused: the moment stays where it was.
    expect(liveSeconds(tl, T0 + 90_000, T0 + 25_000, 60)).toBe(10);
    expect(liveSeconds(tl, T0 + 500_000, null, 60)).toBe(60);
    expect(liveSeconds(tl, T0, null, 60)).toBe(0);
  });

  it('gives every phone in a squad the same Exit letters, and other squads may differ', () => {
    const a = squadExits(mission, 'H7KQ2M', 'hornbill').map((e) => e.choice.id);
    const b = squadExits(mission, 'H7KQ2M', 'hornbill').map((e) => e.choice.id);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(mission.choices.map((c) => c.id).sort());
  });

  it('builds a role card with the merged jobs of a small squad', () => {
    const card = roleCard({ role: 'evidence-checker', covers: ['evidence-checker', 'influence-tracer'], lenses: ['clue', 'thread'], shadow: false, letter: 'S' });
    expect(card.name).toBe('Evidence Checker');
    expect(card.lenses).toBe('Clue, Thread');
    expect(card.alsoCovers).toEqual(['Influence Tracer']);
    const shadow = roleCard({ role: 'evidence-checker', covers: [], lenses: ['clue'], shadow: true, letter: 'S' });
    expect(shadow.name).toBe('Shadow Clue');
    expect(shadow.alsoCovers).toEqual([]);
  });

  it('only offers missions written for the band, Guided first', () => {
    for (const band of ['junior', 'teen', 'young-adult'] as const) {
      const list = missionsForSession(band);
      expect(list.every((m) => m.bands.includes(band))).toBe(true);
      const ranks = list.map((m) => ({ guided: 0, light: 1, wildcard: 2 })[m.scaffold]);
      expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
    }
  });

  it('strings every tactic used to the moment it was used', () => {
    const board = flipBoard([mission.id]);
    const used = new Set(mission.live.beats.map((b) => b.tactic).filter(Boolean));
    expect(board.map((t) => t.tactic.id).sort()).toEqual([...used].sort());
    expect(board.every((t) => TACTICS.includes(t.tactic) && t.moments.length === 1)).toBe(true);
    expect(scriptLine([mission.id])).toMatch(/^It was never .+ fault\. It was a script\.$/);
  });

  it('drops quote marks a label already carries', () => {
    expect(unquote('"Only 5 mins left!!"')).toBe('Only 5 mins left!!');
    expect(unquote('“S$200 for ten minutes”')).toBe('S$200 for ten minutes');
    expect(unquote('A plain label')).toBe('A plain label');
    expect(unquote('S$200 for ten minutes of "work"')).toBe('S$200 for ten minutes of "work"');
  });

  it('draws a shape for every totem except the circle', () => {
    expect(totemPath('triangle')).toBeTruthy();
    expect(totemPath('circle')).toBeNull();
  });

  it('lanterns only count positive progress', () => {
    expect(lanternCount(squad({ holding: 2, sealed: { count: 4, total: 5 }, decided: true, guardians: ['cluepaw'] }))).toBe(6);
  });

  it('names the Conductor’s one big button for the current state', () => {
    const host = (s: Partial<SessionPublic>, squads: HostSnapshot['squads'] = []): HostSnapshot =>
      ({ kind: 'host', session: { ...session(s), hostPath: '/host/H7KQ2M', screenPath: '/screen/H7KQ2M' }, squads }) as unknown as HostSnapshot;
    expect(nextAction(host({ phase: 'lobby', roomFreeze: { active: false, done: false }, missionIndex: null })).label).toBe('Start the Room Freeze');
    expect(nextAction(host({ phase: 'lobby', missionIndex: null })).label).toBe('Start Mission 1');
    expect(nextAction(host({ phase: 'mission', missionComplete: true })).label).toBe('Open the debrief');
    expect(nextAction(host({ phase: 'debrief' })).label).toBe('End the session');
  });

  it('flags a session running behind the run sheet', () => {
    const snap = { kind: 'host', session: { ...session({ timeline: timeline({ openedAt: T0 }) }) }, squads: [] } as unknown as HostSnapshot;
    expect(pacing(snap, null, T0).state).toBe('unknown');
    expect(pacing(snap, T0, T0 + 5 * 60_000).state).toBe('on-track');
    const late = pacing(snap, T0, T0 + 20 * 60_000);
    expect(late.state).toBe('behind');
    expect(late.minutes).toBeGreaterThan(4);
  });
});

describe('Big Screen logic', () => {
  const screen = (s: Partial<SessionPublic>, squads: ScreenSquad[] = []): ScreenSnapshot => ({
    kind: 'screen',
    protocol: 1,
    v: 1,
    serverNow: T0,
    session: session(s),
    squads,
    room: { lanterns: 0, holdsMade: 0, mindsChangedSafer: 0, roomFreeze: { amount: 0, peak: 0 } },
    spotlight: null,
    debrief: null,
  });

  it('follows the least advanced squad, or the shared timeline before squads report', () => {
    expect(roomPhase(screen({}, [squad({ phase: 'explain' }), squad({ id: 'heron', phase: 'reveal' })]), T0)).toBe('reveal');
    expect(roomPhase(screen({}, [squad({ phase: 'bond', complete: true }), squad({ id: 'heron', phase: 'shield' })]), T0)).toBe('shield');
    expect(roomPhase(screen({}), T0 + 1000)).toBe('role-flip');
    expect(roomPhase(screen({}), T0 + 20_000)).toBe('live');
    expect(roomPhase(screen({}), T0 + 80_000)).toBe('investigate');
    expect(roomPhase(screen({ missionComplete: true }), T0)).toBeNull();
    expect(roomPhase(screen({ phase: 'lobby' }), T0)).toBeNull();
  });

  it('shows the shared room clock for synced phases only', () => {
    expect(roomDeadline(timeline(), 'live')?.endsAt).toBe(T0 + 75_000);
    expect(roomDeadline(timeline(), 'investigate')?.endsAt).toBe(T0 + 225_000);
    expect(roomDeadline(timeline(), 'explain')).toBeNull();
  });

  it('squad towers show counts, never choices', () => {
    expect(laneView(squad({ phase: 'live', holding: 3 }), 'mission').status).toBe('3/5 holding');
    const think = laneView(squad({ phase: 'think', sealed: { count: 4, total: 5 } }), 'mission');
    expect(think.status).toBe('4 of 5 sealed');
    expect(think.meter).toEqual({ filled: 4, total: 5, kind: 'lantern' });
    const decided = laneView(squad({ phase: 'reseal', decided: true }), 'mission');
    expect(decided.status).toBe('Hornbill decided');
    expect(decided.beam).toBe(true);
    expect(laneView(squad({ phase: null, connected: 1 }), 'lobby').status).toBe('1 phone in');
  });

  it('captions the newest live line, with the sender’s handle', () => {
    const first = [...mission.live.beats].sort((a, b) => a.at - b.at)[0]!;
    expect(liveCaption(mission, -1)).toBeNull();
    const line = liveCaption(mission, first.at);
    expect(line).toContain(first.text);
  });

  it('keeps district light upward-only and off in Discreet mode', () => {
    const open = { ...defaultSessionOptions('young-adult'), discreet: false };
    expect(screenTrust(screen({ options: open }, [squad({ trust: 2 }), squad({ id: 'heron', trust: 1 })]))).toEqual({ [mission.district]: 1.5 });
    expect(screenTrust(screen({ options: open }, [squad({ trust: -2 }), squad({ id: 'heron', trust: 1 })]))).toEqual({});
    expect(screenTrust(screen({}, [squad({ trust: 2 })]))).toEqual({});
  });

  it('marks played missions as done on the city', () => {
    expect(sessionMarkers(screen({ missionComplete: true }))[0]?.state).toBe('done');
    expect(sessionMarkers(screen({ phase: 'lobby', missionIndex: null }))[0]?.state).toBe('new');
  });

  it('teases the next mission without naming a squad', () => {
    expect(lookUpTeaser(screen({ phase: 'lobby', missionIndex: null }))).toMatch(/^Mission 1 begins in /);
    expect(lookUpTeaser(screen({ missionComplete: true }))).toBeNull();
  });

  it('walks the debrief in run-sheet order, one Flip the Board page per three tactics', () => {
    const debrief: DebriefView = {
      missions: [
        {
          missionId: mission.id,
          squads: 2,
          holdsMade: 8,
          liveFlags: 3,
          heldFlags: 9,
          mindsChangedSafer: 2,
          forecastLikely: 4,
          forecastTotal: 9,
          clueFinds: {},
          shieldLines: [],
        },
      ],
      lanterns: 20,
      roomFreezePeak: 1,
    };
    expect(debriefFrames(null)).toEqual(['fast-forward', 'rewind', 'flip', 'minds', 'carry']);
    expect(debriefFrames(debrief)).toEqual(['fast-forward', 'rewind', 'flip', 'minds', 'clues', 'forecasts', 'carry']);
    const steps = debriefSteps(debrief, [mission.id]);
    const flips = steps.filter((s) => s.frame === 'flip');
    expect(flips.length).toBe(Math.max(1, Math.ceil(flipBoard([mission.id]).length / 3)));
    expect(flips.every((s) => (s.tactics ?? []).length <= 3)).toBe(true);
    expect(steps.at(-1)?.frame).toBe('carry');
  });

  it('finds the sign most squads walked past', () => {
    const red = mission.clues.filter((c) => c.redFlag);
    const finds = Object.fromEntries(red.map((c, i) => [c.id, i + 1]));
    expect(mostMissedClue(mission, finds)?.label).toBe(red[0]?.label);
  });

  it('reads a Shield Line in message order', () => {
    const ps = mission.peerShield;
    if (!ps) return;
    const opener = ps.slots.opener[0]!;
    const channel = ps.slots.channel[0]!;
    expect(shieldLineText(mission, { tiles: { channel: channel.id, opener: opener.id } })).toBe(`${opener.text} ${channel.text}`);
  });
});
