// Plain-language scene description for the role="img" label of the 3D stage and the Flat View picture.
// Everything a player needs is also in the panels; this tells a screen-reader user what the picture shows.
import type { Mission } from '@shieldquest/shared';
import type { MissionSceneProps } from '../../contracts';
import type { AnchorSpot } from '../sets/types';
import { castPose, placeCast } from './cast';
import type { Vec3 } from './staging';

const WHEN: Record<Mission['timeOfDay'], string> = {
  morning: 'in the morning',
  afternoon: 'in the afternoon',
  evening: 'at dusk',
  night: 'at night',
};

const DOING: Record<string, string> = {
  stand: 'stands',
  sit: 'sits',
  phone: 'looks at a phone',
  lean: 'leans',
  walk: 'walks',
  'arms-crossed': 'stands with arms crossed',
  'open-arms': 'opens their arms',
  'curl-up': 'sits curled up',
  'turn-towards': 'turns towards the others',
};

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

export interface DescribeInput {
  mission: Mission;
  setName: string;
  anchors: Record<string, AnchorSpot>;
  seats?: Readonly<Record<string, Vec3>>;
  mode: MissionSceneProps['mode'];
  mood: MissionSceneProps['mood'];
  thread?: MissionSceneProps['thread'];
  rain?: boolean;
}

export function describeScene({ mission, setName, anchors, seats, mode, mood, thread, rain = true }: DescribeInput): string {
  const parts: string[] = [`${setName} ${WHEN[mission.timeOfDay]}.`];
  for (const p of placeCast(mission, anchors, seats)) {
    const where = anchors[p.anchor]?.label ?? p.anchor;
    if (p.kind === 'faceless') {
      parts.push(`A figure with no face stands at the ${lower(where)}.`);
      continue;
    }
    const pose = castPose(p, mood, mode);
    const doing = DOING[pose] ?? 'is';
    parts.push(`${p.member.name} ${doing} at the ${lower(where)}.`);
  }
  if (mode === 'frozen') parts.push(rain ? 'Time is held: everything is still and the rain hangs in the air.' : 'Time is held: everything is still.');
  else if (mode === 'released') parts.push('Time runs again.');
  else if (rain && mode === 'live') parts.push('Rain is falling.');
  if (thread) {
    const who = mission.cast.find((c) => c.id === thread.from)?.name ?? 'someone';
    parts.push(
      thread.revealed
        ? `A glowing string runs tight from ${who} to a lit window, where a figure with no face stands: ${mission.influence.hidden.label}.`
        : `A loose glowing string runs from ${who} towards a lit window in the distance.`,
    );
  }
  return parts.join(' ');
}
