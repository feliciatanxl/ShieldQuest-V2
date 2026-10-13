// Core vocabulary of ShieldQuest V2: the S.H.I.E.L.D. skills, the six Guardians,
// districts, learner bands and the manipulation tactics named by the Pressure Ring.
// Everything here is a grant commitment from the Project SHIELD proposal — change with care.

export const GAME = {
  name: 'ShieldQuest',
  project: 'Project SHIELD',
  team: 'Team SecurePi',
  city: 'ShieldQuest City',
  tagline: 'Choose Right. Protect Together.',
  hook: 'Scams need you to hurry. You can Hold.',
  closing: "You can't freeze time out there. But you can Hold.",
  disclaimer:
    'ShieldQuest is a student project by Team SecurePi (Nanyang Polytechnic). It is not an official SPF, NCPC or Government product. All scenarios are fictional.',
} as const;

export type SkillId = 'S' | 'H' | 'I' | 'E' | 'L' | 'D';

export interface Skill {
  id: SkillId;
  name: string;
  verb: string;
  description: string;
  guardian: GuardianId;
}

export const SKILLS: readonly Skill[] = [
  {
    id: 'S',
    name: 'Spot the Risk',
    verb: 'Spot',
    description: 'Recognise warning signs, suspicious situations and risky peer behaviour.',
    guardian: 'cluepaw',
  },
  {
    id: 'H',
    name: 'Hold Before Acting',
    verb: 'Hold',
    description: 'Pause before responding to pressure, urgency or temptation.',
    guardian: 'echo',
  },
  {
    id: 'I',
    name: 'Identify the Influence',
    verb: 'Identify',
    description: 'Consider who is influencing the decision and what they may gain.',
    guardian: 'verifox',
  },
  {
    id: 'E',
    name: 'Evaluate the Consequences',
    verb: 'Evaluate',
    description: 'Think beyond immediate rewards and consider later impacts.',
    guardian: 'bytebuddy',
  },
  {
    id: 'L',
    name: 'Lead the Right Choice',
    verb: 'Lead',
    description: 'Choose the safer and more responsible response.',
    guardian: 'beacon',
  },
  {
    id: 'D',
    name: 'Defend Your Community',
    verb: 'Defend',
    description: 'Look out for peers and help stop risky behaviour from escalating.',
    guardian: 'shieldfin',
  },
] as const;

export const skillById = (id: SkillId): Skill => SKILLS.find((s) => s.id === id)!;

export type GuardianId = 'verifox' | 'echo' | 'beacon' | 'shieldfin' | 'cluepaw' | 'bytebuddy';

export interface Guardian {
  id: GuardianId;
  name: string;
  creature: string;
  skill: SkillId;
  preventionSkill: string;
  /** What the Guardian does in play once it has unfolded. */
  ability: string;
  abilityName: string;
  /** Primary colour (paired with the creature silhouette, never colour alone). */
  color: string;
}

export const GUARDIANS: readonly Guardian[] = [
  {
    id: 'cluepaw',
    name: 'Cluepaw',
    creature: 'origami cat with ink paw prints',
    skill: 'S',
    preventionSkill: 'Situational awareness',
    abilityName: 'Sniff Out',
    ability: 'Reveals one overlooked clue in a frozen moment.',
    color: '#f59e0b',
  },
  {
    id: 'echo',
    name: 'Echo',
    creature: 'origami otter',
    skill: 'H',
    preventionSkill: 'Help-seeking and consultation',
    abilityName: 'Second Opinion',
    ability: "Invites one more teammate's explanation before you lock in.",
    color: '#a78bfa',
  },
  {
    id: 'verifox',
    name: 'VeriFox',
    creature: 'origami fox with a magnifier-fold tail',
    skill: 'I',
    preventionSkill: 'Verification before action',
    abilityName: 'Check the Source',
    ability: 'Checks one claim against trusted information.',
    color: '#fb7185',
  },
  {
    id: 'bytebuddy',
    name: 'ByteBuddy',
    creature: 'folded cube robot with a fold-out screen face',
    skill: 'E',
    preventionSkill: 'Cyber hygiene',
    abilityName: 'Data Scan',
    ability: 'Highlights unsafe links, permissions and data requests.',
    color: '#38bdf8',
  },
  {
    id: 'beacon',
    name: 'Beacon',
    creature: 'origami lantern firefly',
    skill: 'L',
    preventionSkill: 'Personal safety and escalation',
    abilityName: 'Safe Channel',
    ability: 'Lights up a safe, trusted channel for help or reporting.',
    color: '#facc15',
  },
  {
    id: 'shieldfin',
    name: 'Shieldfin',
    creature: 'origami manta ray whose wings spread into a shield',
    skill: 'D',
    preventionSkill: 'Refusal skills and peer support',
    abilityName: 'Fin Guard',
    ability: 'Blocks one pressure surge aimed at you or a teammate.',
    color: '#2dd4bf',
  },
] as const;

export const guardianById = (id: GuardianId): Guardian => GUARDIANS.find((g) => g.id === id)!;
export const guardianForSkill = (skill: SkillId): Guardian => GUARDIANS.find((g) => g.skill === skill)!;

/** Bond thresholds: a Guardian unfolds at 1 skill demonstration and grows at 3 and 6. */
export const GUARDIAN_BOND_LEVELS = [1, 3, 6] as const;

export type BandId = 'junior' | 'teen' | 'young-adult';

export interface Band {
  id: BandId;
  label: string;
  ages: string;
  segment: string;
  design: string;
}

export const BANDS: readonly Band[] = [
  {
    id: 'junior',
    label: 'Junior',
    ages: '10–13',
    segment: 'Primary / Early Secondary',
    design: 'Simpler language, visual clues, guided decisions and 2–3 clear choices.',
  },
  {
    id: 'teen',
    label: 'Teen',
    ages: '14–16',
    segment: 'Secondary',
    design: 'Team voting, branching outcomes, social pressure and growing consequence complexity.',
  },
  {
    id: 'young-adult',
    label: 'Young Adult',
    ages: '17–24',
    segment: 'Post-Secondary / Tertiary',
    design: 'More ambiguous evidence, competing priorities, financial risks and realistic decisions.',
  },
] as const;

export const bandById = (id: BandId): Band => BANDS.find((b) => b.id === id)!;

export type DistrictId = 'school-street' | 'retail-district' | 'digi-district' | 'void-deck-commons' | 'interchange';

export interface District {
  id: DistrictId;
  name: string;
  chapter: string;
  theme: string;
  color: string;
  /** Expansion plates are shown fogged on the map until reviewed content exists. */
  comingSoon?: boolean;
}

export const DISTRICTS: readonly District[] = [
  {
    id: 'school-street',
    name: 'School Street',
    chapter: 'Close to Home',
    theme: 'Game scams, cyberbullying, stranger approaches and digital identity.',
    color: '#2BB3A3',
  },
  {
    id: 'retail-district',
    name: 'Retail District',
    chapter: 'The Cost of a Dare',
    theme: 'Shop-theft dares, harassment, data requests and SIM-card asks.',
    color: '#F26B5B',
  },
  {
    id: 'digi-district',
    name: 'Digi-District',
    chapter: 'Too Good to Be True',
    theme: 'Money mules, online shopping scams, phishing and job scams.',
    color: '#8A6CF0',
  },
  {
    id: 'void-deck-commons',
    name: 'Void Deck Commons',
    chapter: 'Coming soon',
    theme: 'Opens when new reviewed missions are ready.',
    color: '#34d399',
    comingSoon: true,
  },
  {
    id: 'interchange',
    name: 'Interchange',
    chapter: 'Coming soon',
    theme: 'Opens when new reviewed missions are ready.',
    color: '#F2C14E',
    comingSoon: true,
  },
] as const;

export const districtById = (id: DistrictId): District => DISTRICTS.find((d) => d.id === id)!;

/** Manipulation tactics. The Pressure Ring names each one live as it lands. */
export type TacticId =
  | 'urgency'
  | 'too-good'
  | 'everyone-does-it'
  | 'authority'
  | 'secrecy'
  | 'loyalty'
  | 'fear'
  | 'small-ask'
  | 'fake-proof';

export interface Tactic {
  id: TacticId;
  ringLabel: string;
  name: string;
  designedTo: string;
  counter: string;
}

export const TACTICS: readonly Tactic[] = [
  {
    id: 'urgency',
    ringLabel: 'URGENCY',
    name: 'Manufactured urgency',
    designedTo: 'rush you so you act before you can think or check',
    counter: 'Real offers and real officials can wait for you to check. Pause first.',
  },
  {
    id: 'too-good',
    ringLabel: 'BIG REWARD',
    name: 'Too good to be true',
    designedTo: 'make the reward feel bigger than the risk',
    counter: 'Ask why someone would pay this much for so little. Easy money usually has a hidden cost.',
  },
  {
    id: 'everyone-does-it',
    ringLabel: 'EVERYONE DOES IT',
    name: 'Social proof',
    designedTo: 'make a risky choice feel normal and safe because others seem to do it',
    counter: '"Everyone" is rarely everyone. Decide on the facts, not the crowd.',
  },
  {
    id: 'authority',
    ringLabel: 'AUTHORITY',
    name: 'Fake authority',
    designedTo: 'make you obey without questioning by pretending to be someone official',
    counter: 'Hang up and contact the organisation yourself through its official number or website.',
  },
  {
    id: 'secrecy',
    ringLabel: 'KEEP IT SECRET',
    name: 'Isolation and secrecy',
    designedTo: 'stop you from asking anyone who might spot the problem',
    counter: 'If someone tells you not to tell anyone, that is the moment to tell someone.',
  },
  {
    id: 'loyalty',
    ringLabel: 'DO IT FOR ME',
    name: 'Guilt and loyalty',
    designedTo: 'turn friendship into pressure so saying no feels like betrayal',
    counter: 'A real friend can hear "no". You can care about someone and still refuse.',
  },
  {
    id: 'fear',
    ringLabel: 'THREAT',
    name: 'Fear and threats',
    designedTo: 'scare you into acting fast to make a problem go away',
    counter: 'Threats are a pressure tool. Stop, keep the evidence, and get help from a trusted adult.',
  },
  {
    id: 'small-ask',
    ringLabel: 'JUST ONCE',
    name: 'The small first step',
    designedTo: 'make a big risk look like a tiny favour, so the next step feels easier',
    counter: '"Just once" is how bigger asks begin. Judge the first step as if it were the last.',
  },
  {
    id: 'fake-proof',
    ringLabel: 'TRUST ME',
    name: 'Proof you cannot check',
    designedTo: 'reassure you with screenshots, reviews or badges that the sender controls',
    counter: 'Proof from the person asking is not proof. Verify through a source you find yourself.',
  },
] as const;

export const tacticById = (id: TacticId): Tactic => TACTICS.find((t) => t.id === id)!;

/** The six-stage learning loop from the proposal, as mission phases map onto it. */
export const LEARNING_LOOP = [
  { stage: 'Explore', detail: 'Glide into a district and meet a moment as it unfolds.' },
  { stage: 'Investigate', detail: 'Freeze time and inspect chats, people and places for clues.' },
  { stage: 'Discuss', detail: 'Think privately, vote, then hear the reasons behind other views.' },
  { stage: 'Decide', detail: 'Choose a response while the pressure is still on.' },
  { stage: 'Experience', detail: 'Live the result now, and the Aftershock that comes later.' },
  { stage: 'Protect', detail: 'Use what you learned to help a friend facing the same pressure.' },
] as const;

/** Squad totems: a shape and an animal name, so squads are never told apart by colour alone. */
export const SQUAD_TOTEMS = [
  { id: 'hornbill', name: 'Hornbill', shape: 'triangle', color: '#F26B5B' },
  { id: 'pangolin', name: 'Pangolin', shape: 'circle', color: '#2BB3A3' },
  { id: 'kingfisher', name: 'Kingfisher', shape: 'square', color: '#38bdf8' },
  { id: 'heron', name: 'Heron', shape: 'diamond', color: '#8A6CF0' },
  { id: 'civet', name: 'Civet', shape: 'star', color: '#F2C14E' },
  { id: 'macaque', name: 'Macaque', shape: 'hexagon', color: '#f472b6' },
] as const;

export type SquadTotemId = (typeof SQUAD_TOTEMS)[number]['id'];

/** Rotating squad roles (seat index + mission index, modulo roles). */
export const SQUAD_ROLES = [
  { id: 'safety-lead', name: 'Safety Lead', job: 'Keeps the squad on the safer, more responsible choice and breaks ties with a reason.', lens: 'Safe exits' },
  { id: 'evidence-checker', name: 'Evidence Checker', job: 'Finds clues and asks: can we check this ourselves?', lens: 'Clues' },
  { id: 'peer-supporter', name: 'Peer Supporter', job: 'Thinks about how the friend feels and how to help without blame.', lens: 'Feelings' },
  { id: 'influence-tracer', name: 'Influence Tracer', job: 'Follows the strings: who is pushing, and what do they gain?', lens: 'Strings' },
  { id: 'future-reader', name: 'Future Reader', job: 'Looks ahead: what could happen tonight, next week, next month?', lens: 'Futures' },
] as const;

export type SquadRoleId = (typeof SQUAD_ROLES)[number]['id'];
