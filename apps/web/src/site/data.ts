// Copy and facts for the public website. Everything here is plain data so pages stay readable
// and figures can be re-verified in one place before each pilot phase.
import type { HelpChannelId, SkillId } from '@shieldquest/shared';

export interface SiteSource {
  publisher: string;
  title: string;
}

const SPF_SCAM_2025: SiteSource = { publisher: 'Singapore Police Force', title: 'Annual Scam and Cybercrime Brief 2025' };
const SPF_SCAM_H1_2026: SiteSource = { publisher: 'Singapore Police Force', title: 'Mid-Year Scam and Cybercrime Brief 2026' };
const SPF_CRIME_2025: SiteSource = { publisher: 'Singapore Police Force', title: 'Annual Crime Brief 2025' };

/**
 * The only statistics the site may show (verified for the Project SHIELD proposal).
 * 41,974 is scam AND cybercrime cases combined: never call it "41,974 scams".
 */
export const STATS = {
  cases: { value: '41,974', label: 'scam and cybercrime cases in 2025', source: SPF_SCAM_2025 },
  lost: { prefix: 'About', value: 'S$913.1', unit: 'million', label: 'lost in 2025', source: SPF_SCAM_2025 },
  selfTransfer: {
    value: '81.8%',
    label: 'of scams in 2025 involved victims being manipulated into making the transfers themselves',
    source: SPF_SCAM_2025,
  },
  youth2025: {
    value: '5.6%',
    label: 'of scam victims in 2025 were youths aged 19 and below',
    breakdownLabel: 'Of those youth victims, the top scam types were',
    breakdown: [
      { label: 'E-commerce scams', value: 36.6 },
      { label: 'Phishing scams', value: 15.1 },
      { label: 'Job scams', value: 12.8 },
    ],
    source: SPF_SCAM_2025,
  },
  youthH1: {
    value: '6.6%',
    label: 'of scam victims in the first half of 2026 were aged 19 and below',
    share: { label: 'were e-commerce scams', value: 45.6 },
    source: SPF_SCAM_H1_2026,
  },
  shopTheft: {
    value: '4,109',
    label: 'shop theft cases in 2025, one of the top offences among youths arrested',
    source: SPF_CRIME_2025,
  },
} as const;

/** S.H.I.E.L.D. letters practised at each stage of the six-stage loop (GAME_DESIGN.md §5.1). */
export const LOOP_DETAIL: readonly { tag?: string; letters: SkillId[] }[] = [
  { letters: ['S'] },
  { tag: 'HOLD', letters: ['H', 'S', 'I'] },
  { letters: ['E', 'L'] },
  { letters: ['L'] },
  { tag: 'Aftershock', letters: ['E'] },
  { tag: 'Peer Shield', letters: ['D'] },
];

/** The four blocks of a facilitated session (GAME_DESIGN.md §7.2). */
export const SESSION_BLOCKS = [
  { id: 'onboarding', label: 'Onboarding', minutes: 15, detail: 'Ground rules, QR join, the before-check and the Room Freeze.' },
  { id: 'gameplay', label: 'Gameplay', minutes: 45, detail: 'Two or three missions with Look Up breaks in between.' },
  { id: 'debrief', label: 'Debrief', minutes: 20, detail: 'The Rewind, Flip the Board, Stop Frames and Shield Lines.' },
  { id: 'evaluation', label: 'Evaluation', minutes: 10, detail: 'The after-check, quick feedback and the closing card.' },
] as const;

export interface RunSheetRow {
  clock: string;
  segment?: string;
  what: string;
}

/** The 90-minute run sheet, condensed from GAME_DESIGN.md §7.2. */
export const RUN_SHEET: readonly RunSheetRow[] = [
  {
    clock: '00:00–03:00',
    segment: 'Onboarding · 15 min',
    what: 'Welcome scene over Lumen at 11:59. Ground rules: respect, nobody has to share anything personal, Pause and Pass are always OK. Read the disclaimer aloud.',
  },
  { clock: '03:00–06:00', what: 'Students scan the QR code, set Comfort Settings, note their session code and tap their table’s totem.' },
  { clock: '06:00–11:00', what: 'Before-check (Calibration, Form A or B). The 3D world quietly preloads in the background.' },
  { clock: '11:00–13:00', what: 'Six Beats: each S.H.I.E.L.D. letter lights a district and a Guardian while you explain it.' },
  { clock: '13:00–15:00', what: 'The Room Freeze (“Everyone, press and hold”), then a 75-second practice freeze. Roles are dealt.' },
  { clock: '15:00–28:00', segment: 'Gameplay · 45 min', what: 'Mission 1 (Guided): prompts under every letter.' },
  { clock: '28:00–29:30', what: 'Look Up #1: all phones freeze. Eyes up, stretch. The Big Screen shows the City Pulse.' },
  { clock: '29:30–44:00', what: 'Mission 2 (Light), opening with its Aftershock slot.' },
  { clock: '44:00–45:30', what: 'Look Up #2.' },
  {
    clock: '45:30–55:00',
    what: 'Mission 3: a Wildcard Sprint or a Peer Shield mission. Dropped automatically if the room is more than 4 minutes behind.',
  },
  { clock: '55:00–58:00', what: 'The Long Fast-Forward: “+2 weeks”. Every remaining Aftershock lands, with recovery routes.' },
  { clock: '58:00–60:00', what: 'Buffer.' },
  { clock: '60:00–62:00', segment: 'Debrief · 20 min', what: 'The Rewind: the session plays backwards on the projector. Phones are dark.' },
  {
    clock: '62:00–65:00',
    what: 'Flip the Board: the manipulator’s corkboard, every tactic strung to the moment it was used. “It was never Ren’s fault. It was a script.”',
  },
  { clock: '65:00–74:00', what: 'Three Stop Frames with scripted prompts. Phones become the Debrief Companion (anonymous polls).' },
  { clock: '74:00–78:00', what: 'Shield Lines Wall: “What would you actually say to Dev?” Optional pair role-play.' },
  { clock: '78:00–80:00', what: 'Carry It Out: a private If-Then card kept on the phone, the Help Card, and S.H.I.E.L.D. mapped to Add / Check / Tell.' },
  { clock: '80:00–86:00', segment: 'Evaluation · 10 min', what: 'After-check (the other form). The session code is pre-filled.' },
  { clock: '86:00–89:00', what: 'Feedback: five usability items plus engagement and clarity questions.' },
  { clock: '89:00–90:00', what: 'Closing: the Stillpoint ticks to 12:00. “You can’t freeze time out there. But you can Hold.”' },
];

/** Six evaluation KPIs (GAME_DESIGN.md §7.5). In-game signals are aggregates, never per person. */
export const KPIS = [
  {
    name: 'Risk recognition',
    question: 'Can players tell a genuine message from a fake one, and how sure are they?',
    measure: 'Genuine-vs-fake Twin pairs with confidence',
    signal: 'Flags found while holding; most-missed clues',
  },
  {
    name: 'Decision accuracy',
    question: 'Do they pick the safer move in new scenarios they have never played?',
    measure: 'Three held-out scenarios never used in play',
    signal: 'Wildcard first-vote safer rate',
  },
  {
    name: 'Consequence awareness',
    question: 'Can they see what comes next: tonight, next week, next month, and who else is affected?',
    measure: 'Consequence timeline items (now, days, weeks)',
    signal: 'Forecast and Ripple Trace accuracy',
  },
  {
    name: 'Peer-intervention confidence',
    question: 'Do they feel ready to step in and help a friend who is under pressure?',
    measure: 'Self-efficacy items plus a situational-judgement item',
    signal: 'Peer Shield success rate',
  },
  {
    name: 'Retention',
    question: 'Is the skill still there two to four weeks later?',
    measure: 'Return visit form 2–4 weeks later vs the after-check',
    signal: 'Return completion count',
  },
  {
    name: 'Engagement',
    question: 'Do they finish the session, and choose to play again on their own?',
    measure: 'Session and scenario completion, average duration',
    signal: 'Voluntary replays at home',
  },
] as const;

/** Help channel groups for the Get help page (contacts come only from HELP_CHANNELS). */
export const HELP_GROUPS: readonly { id: string; title: string; intro: string; ids: HelpChannelId[] }[] = [
  {
    id: 'check',
    title: 'Check if it’s a scam',
    intro: 'Not sure about a message, call, job or deal? Check before you reply, click or pay.',
    ids: ['scamshield-1799', 'scamshield-report'],
  },
  {
    id: 'report',
    title: 'Report or get it stopped',
    intro: 'If money moved, details were shared, or someone is being harmed online.',
    ids: ['bank', 'police-hotline', 'osc', 'police-999', 'police-sms-70999'],
  },
  {
    id: 'talk',
    title: 'Talk to someone',
    intro: 'Feeling stressed, scared or upset, about a scam or anything else? You can reach out any time.',
    ids: ['trusted-adult', 'mindline-1771', 'sos-1767', 'tinkle-friend'],
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const HOME_FAQ: readonly FaqItem[] = [
  {
    q: 'Do students need to download an app?',
    a: 'No. ShieldQuest runs in the web browser. Students scan a QR code and play in about 10 to 20 seconds. Adding it to the home screen is offered, never required.',
  },
  {
    q: 'Do players sign up or give their name?',
    a: 'Never. There are no accounts and no name fields anywhere a player goes. In a squad session, each phone gets a generated nickname such as “Teal Kite”. Solo progress stays in the browser on that device.',
  },
  {
    q: 'Will it work on older phones and school Wi-Fi?',
    a: 'Yes. Graphics adjust automatically, and a full 2D mode works on any phone, even without 3D graphics. A whole classroom session is designed to use under 3 MB per phone, so a 4G hotspot works as a backup.',
  },
  {
    q: 'What ages is it for?',
    a: 'Three content bands: Junior (10–13), Teen (14–16) and Young Adult (17–24). Each band gets its own wording, number of choices and level of consequence detail. The game asks “Which fits you best?”, never a date of birth.',
  },
  {
    q: 'Is this an official police or government game?',
    a: 'No. ShieldQuest is a student project by Team SecurePi (Nanyang Polytechnic). It is not an official SPF, NCPC or Government product, and all scenarios, people and brands are fictional.',
  },
  {
    q: 'Does anyone have to share personal experiences?',
    a: 'No, and the game never asks. Every mission is about a fictional character, so players decide what that character does. Pause is on every screen, and anyone can step out at any time.',
  },
  {
    q: 'How long does it take?',
    a: 'A facilitated class session runs for 90 minutes, including the before-and-after checks. Played solo, each mission takes a few minutes, and the game suggests a natural stopping point.',
  },
  {
    q: 'Can students play at home afterwards?',
    a: 'Yes. Solo play needs no login and works on any phone or laptop. Guardians and progress are saved only on that device.',
  },
];

/**
 * How partners reach the team. No form and no email collection on the site: we only show a way
 * to reach us. `email` stays empty until the team has an official address approved for the pilot.
 */
export const CONTACT: { text: string; via: string; email: string } = {
  text: 'Interested in a pilot at your school or youth organisation? Reach Team SecurePi through Nanyang Polytechnic.',
  via: 'Educators and partners can also ask their institution’s Nanyang Polytechnic contact to connect them with the team.',
  // TODO(team): add the official contact address approved for the pilot. The email line is hidden while this is empty.
  email: '',
};

/** Game-based learning research named in the Project SHIELD proposal. Cited, not quoted. */
export const RESEARCH: readonly { authors: string; year: number; venue: string }[] = [
  { authors: 'Ruiz, Sanchez & Figueredo', year: 2024, venue: 'Frontiers in Education' },
  { authors: 'Henriksen-Bulmer et al.', year: 2024, venue: 'Interactive Learning Environments' },
];

/** The pilot plan, always in future tense: nothing here is approved or endorsed yet. */
export const ROADMAP: readonly { step: string; title: string; body: string }[] = [
  {
    step: 'Step 1',
    title: 'Co-design with youths',
    body: 'Young people will test Hold timing, wording and the before-and-after check items, so the game is shaped by the people it is for.',
  },
  {
    step: 'Step 2',
    title: 'Build and review',
    body: 'Missions, the Scenario Portal and the facilitator toolkit will be finished, reviewed for accuracy and safeguarding, then rehearsed end to end.',
  },
  {
    step: 'Step 3',
    title: 'Tertiary pilot first',
    body: 'Pilots are planned from early 2027, starting with tertiary students aged 17 to 24, subject to partner confirmation.',
  },
  {
    step: 'Step 4',
    title: 'Wider youth and community pilots',
    body: 'Then secondary-school, youth-group and community sessions, around 200 youths in total, followed by an aggregate impact report.',
  },
];

export const TEAM: readonly { name: string; role: string; initials: string }[] = [
  { name: 'Felicia Tan', role: 'Product and technology', initials: 'FT' },
  { name: 'Charlisa Tan', role: 'Research and content', initials: 'CT' },
];

export const NEVER_COLLECT = [
  'Names or nicknames you type',
  'Ages or dates of birth',
  'School or class names',
  'Phone numbers or email addresses',
  'NRIC or FIN numbers',
  'Photos, voice or video',
  'Location, contacts or camera access',
  'IP addresses or device details in our logs',
] as const;

export const WHAT_WE_USE = [
  {
    title: 'Your settings and solo progress',
    detail: 'Text size, motion, Guardians and story progress. Saved in your browser on this device only. Clearing site data removes it.',
  },
  {
    title: 'A random seat token (squad sessions)',
    detail: 'So you can rejoin your squad if your phone drops off. It identifies a seat, not a person, and is deleted within 24 hours of the session closing.',
  },
  {
    title: 'Group counts (squad sessions)',
    detail: 'How many sealed a vote, how many minds changed towards safer, how many held early. Counted per squad, never per person.',
  },
  {
    title: 'Before-and-after check answers',
    detail: 'Linked only to a random session code such as KAYA-7K2, stored separately from gameplay, with no way to join the two.',
  },
  {
    title: 'Anonymous solo counters',
    detail: 'Which mission, band and choice, with no identifier at all. Used to improve the scenarios.',
  },
] as const;

export const RETENTION = [
  { what: 'Live session state (who sealed what)', keep: 'In server memory during the session; any crash snapshot is deleted within 24 hours' },
  { what: 'Seat tokens', keep: 'Deleted within 24 hours of the session closing' },
  { what: 'Squad and session aggregates', keep: 'Kept for the impact report; only shown for groups of 5 or more' },
  { what: 'Before-and-after check answers', keep: 'Deleted 90 days after the final report' },
  { what: 'Youth-made Moment Cards that are not approved', keep: 'Deleted after 30 days' },
  { what: 'Solo progress and settings', keep: 'On your device until you clear it' },
] as const;
