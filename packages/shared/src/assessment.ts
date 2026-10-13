// Pre/post/return assessment ("Calibration") and the Return visit. GAME_DESIGN.md §7.5, §7.6, §9.4, §11.
//
// - Forms A, B and C are parallel: the same slots (type, KPI, band tier) filled with different but
//   equivalent items. Pre and post use A and B, counterbalanced by the parity of the code's hash, so half
//   a room sees A first. The Return visit uses C plus the "jammed Freeze" retention set.
// - Items are plain 2D DOM content (never 3D), so the quality of a phone cannot bias a score.
// - Twin pairs are used only here (and in the tutorial); they are never reused inside missions.
// - Responses are keyed by a random pseudonymous code (e.g. KAYA-7K2). No names, ages, schools or
//   contact details exist anywhere in this module, and results are only ever reported for groups of
//   ASSESSMENT_MIN_GROUP or more.

import type { BandId, TacticId } from './framework';

// ---------------------------------------------------------------------------------------------
// Vocabulary

export type AssessmentKind = 'pre' | 'post' | 'return';
export const ASSESSMENT_KINDS: readonly AssessmentKind[] = ['pre', 'post', 'return'];
export const isAssessmentKind = (v: unknown): v is AssessmentKind => v === 'pre' || v === 'post' || v === 'return';

export type AssessmentForm = 'A' | 'B' | 'C';

/** Bump when items change in a way that affects scoring (stored on every response). */
export const ASSESSMENT_BANK_VERSION = 1;

/** Smallest group any result may be reported for (GDD §7.5, §11.11). */
export const ASSESSMENT_MIN_GROUP = 5;

/** The six grant KPIs. */
export type AssessmentKpiId = 'risk' | 'decision' | 'consequence' | 'peer' | 'retention' | 'engagement';

export type AssessmentSectionId = 'jammed' | 'spot' | 'flags' | 'decide' | 'later' | 'friend' | 'sure' | 'feedback';

export const ASSESSMENT_SECTIONS: Record<AssessmentSectionId, { title: string; hint: string }> = {
  jammed: { title: 'The jammed Freeze', hint: 'Out here, time does not stop. Practise a real-world Hold.' },
  spot: { title: 'Spot the scam', hint: 'One message in each pair is a scam. Tap the scam.' },
  flags: { title: 'Find the warning signs', hint: 'Tap every part of the message that is a warning sign.' },
  decide: { title: 'The safest move', hint: 'Pick the one safest thing to do.' },
  later: { title: 'What happens later?', hint: 'Think beyond right now: days and weeks ahead.' },
  friend: { title: 'Helping a friend', hint: 'Pick the best thing to say.' },
  sure: { title: 'How sure are you?', hint: 'There are no right or wrong answers here.' },
  feedback: { title: 'What did you think?', hint: 'Your honest view helps us improve ShieldQuest.' },
};

export type MessageChannel = 'sms' | 'chat' | 'email' | 'app' | 'game';

/** A fictional message shown on a paper card. Brands are fictional; links use .test domains. */
export interface AssessmentMessage {
  channel: MessageChannel;
  from: string;
  text: string;
}

interface ItemBase {
  id: string;
  /** '*' = the same item in every form (attitude scales must be identical before and after). */
  form: AssessmentForm | '*';
  /** Display order; parallel forms share the same order slots. */
  order: number;
  bands: readonly BandId[];
  kinds: readonly AssessmentKind[];
  kpi: AssessmentKpiId;
  section: AssessmentSectionId;
}

export type TwinPick = 'a' | 'b' | 'both' | 'neither';

/** A genuine and a scam version of the same kind of message, side by side. */
export interface TwinItem extends ItemBase {
  type: 'twin';
  tactic: TacticId;
  a: AssessmentMessage;
  b: AssessmentMessage;
  scam: 'a' | 'b';
  /** One line on the trick, blaming the tactic (shown only in the answer review after post/return). */
  cue: string;
}

export type FlagKind = TacticId | 'link' | 'data';

/** Tap every warning sign in a short message. Ordinary segments teach that not everything is a trap. */
export interface FlagsItem extends ItemBase {
  type: 'flags';
  message: Omit<AssessmentMessage, 'text'>;
  segments: readonly { id: string; text: string; flag?: FlagKind }[];
}

export interface ChoiceOption {
  id: string;
  text: string;
  best?: true;
}

/** Multiple choice with exactly one best answer (transfer vignettes, consequence and peer judgement items). */
export interface ChoiceItem extends ItemBase {
  type: 'choice';
  scenario: string;
  question: string;
  /** Consequence Timeline horizon (GDD §7.5 KPI 3). */
  horizon?: 'now' | 'days' | 'weeks' | 'who';
  options: readonly ChoiceOption[];
}

export type LikertScale = 'sure' | 'agree';

export interface LikertItem extends ItemBase {
  type: 'likert';
  prompt: string;
  statement: string;
  scale: LikertScale;
}

/** Single choice with a numeric value per option (e.g. "Would you play again?"). */
export interface PollItem extends ItemBase {
  type: 'poll';
  question: string;
  options: readonly { id: string; text: string; value: number }[];
}

/** Pick-any reflection chips. There is no free text anywhere in Calibration. */
export interface ChipsItem extends ItemBase {
  type: 'chips';
  question: string;
  chips: readonly { id: string; text: string }[];
}

/** Return visit: HOLD fails for a second, then the player makes a real-world Hold and chooses who to tell. */
export interface JammedItem extends ItemBase {
  type: 'jammed';
  message: AssessmentMessage;
  question: string;
  options: readonly ChoiceOption[];
  tellQuestion: string;
  tell: readonly { id: string; text: string; trusted: boolean }[];
}

export type AssessmentItem = TwinItem | FlagsItem | ChoiceItem | LikertItem | PollItem | ChipsItem | JammedItem;
export type AssessmentItemType = AssessmentItem['type'];

export type LikertValue = 1 | 2 | 3 | 4 | 5;
export type ConfidenceValue = 1 | 2 | 3;

export type AssessmentAnswer =
  | { type: 'twin'; pick: TwinPick; confidence?: ConfidenceValue }
  | { type: 'flags'; picked: string[] }
  | { type: 'choice'; option: string }
  | { type: 'likert'; value: LikertValue }
  | { type: 'poll'; option: string }
  | { type: 'chips'; chips: string[] }
  | { type: 'jammed'; option?: string; tell: string[] };

/** Answers keyed by item id. A skipped item is simply absent. */
export type AssessmentAnswers = Record<string, AssessmentAnswer>;

export const LIKERT_LABELS: Record<LikertScale, readonly [string, string, string, string, string]> = {
  sure: ['Not at all sure', 'A little sure', 'Quite sure', 'Very sure', 'Completely sure'],
  agree: ['Strongly disagree', 'Disagree', 'Not sure', 'Agree', 'Strongly agree'],
};

export const CONFIDENCE_LABELS: Record<ConfidenceValue, string> = { 1: 'Guessing', 2: 'Fairly sure', 3: 'Very sure' };

export const TWIN_PICK_LABELS: Record<TwinPick, string> = {
  a: 'Message A is the scam',
  b: 'Message B is the scam',
  both: 'Both look like scams',
  neither: 'Neither: both look genuine',
};

// ---------------------------------------------------------------------------------------------
// Item bank

const ALL: readonly BandId[] = ['junior', 'teen', 'young-adult'];
const JR: readonly BandId[] = ['junior'];
const OLDER: readonly BandId[] = ['teen', 'young-adult'];
const TEEN: readonly BandId[] = ['teen'];
const YA: readonly BandId[] = ['young-adult'];
const EVERY_KIND: readonly AssessmentKind[] = ['pre', 'post', 'return'];

const msg = (channel: MessageChannel, from: string, text: string): AssessmentMessage => ({ channel, from, text });

function twin(
  id: string,
  form: AssessmentForm,
  order: number,
  bands: readonly BandId[],
  tactic: TacticId,
  scam: 'a' | 'b',
  a: AssessmentMessage,
  b: AssessmentMessage,
  cue: string,
): TwinItem {
  return { id, type: 'twin', form, order, bands, kinds: EVERY_KIND, kpi: 'risk', section: 'spot', tactic, scam, a, b, cue };
}

function flags(
  id: string,
  form: AssessmentForm,
  bands: readonly BandId[],
  message: Omit<AssessmentMessage, 'text'>,
  segments: readonly (readonly [string] | readonly [string, FlagKind])[],
): FlagsItem {
  return {
    id,
    type: 'flags',
    form,
    order: 20,
    bands,
    kinds: EVERY_KIND,
    kpi: 'risk',
    section: 'flags',
    message,
    segments: segments.map(([text, flag], i) => (flag ? { id: `s${i + 1}`, text, flag } : { id: `s${i + 1}`, text })),
  };
}

const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;

function options(best: number, texts: readonly string[]): ChoiceOption[] {
  return texts.map((text, i) => (i === best ? { id: OPTION_IDS[i] ?? `o${i}`, text, best: true } : { id: OPTION_IDS[i] ?? `o${i}`, text }));
}

function choice(
  id: string,
  form: AssessmentForm,
  order: number,
  bands: readonly BandId[],
  kind: 'decide' | 'later' | 'friend',
  scenario: string,
  question: string,
  best: number,
  texts: readonly string[],
  horizon?: ChoiceItem['horizon'],
): ChoiceItem {
  const kpi: AssessmentKpiId = kind === 'decide' ? 'decision' : kind === 'later' ? 'consequence' : 'peer';
  const item: ChoiceItem = {
    id,
    type: 'choice',
    form,
    order,
    bands,
    kinds: EVERY_KIND,
    kpi,
    section: kind,
    scenario,
    question,
    options: options(best, texts),
  };
  return horizon ? { ...item, horizon } : item;
}

const LATER_DAYS = 'What is most likely to happen in the next few days?';
const LATER_WEEKS = 'What is most likely to happen a few weeks later?';
const BEST_SAY = 'What is the best thing to say?';

// Form A ---------------------------------------------------------------------------------------

const FORM_A: AssessmentItem[] = [
  twin(
    'A.tw.1',
    'A',
    10,
    ALL,
    'authority',
    'b',
    msg('sms', 'CityPass', 'Your CityPass one-time code is 482 913. Never share this code with anyone, not even CityPass staff.'),
    msg('sms', 'CityPass Help', 'Hi, this is CityPass support. We are fixing your account. Please reply with the 6-digit code we just sent you.'),
    'Real services never ask you to send them your one-time code. The scam borrows a trusted name to look official.',
  ),
  twin(
    'A.tw.2',
    'A',
    11,
    ALL,
    'too-good',
    'a',
    msg('sms', 'MiniMart 24', 'You are our 1,000,000th visitor! Claim your $500 voucher now: enter your card details at minimart24-winner.test'),
    msg('sms', 'MiniMart 24', 'Members get double points this weekend. Just scan your member card at the counter.'),
    'A huge prize you never entered for, plus a request for card details, is the classic too-good-to-be-true hook.',
  ),
  twin(
    'A.tw.3',
    'A',
    12,
    ALL,
    'urgency',
    'b',
    msg('game', 'Lumen Legends', 'Season 4 starts on Friday! New maps and a free starter pack for every player. See the in-game news.'),
    msg('game', 'Lumen Legends Admin', 'Your account will be DELETED in 10 minutes. Log in at legends-keep.test with your password to keep it.'),
    'A countdown plus a strange link is designed to rush you. Real game news appears inside the game.',
  ),
  twin(
    'A.tw.4j',
    'A',
    13,
    JR,
    'too-good',
    'a',
    msg('game', 'ProGifter99 (player)', "I give free gems to the first 5 people! Just tell me your username and password and I'll add them."),
    msg('game', 'Lumen Legends', 'Your daily reward is ready! Open the game to collect your 50 free gems.'),
    'Nobody needs your password to give you something. Free gifts that need your login are a trick.',
  ),
  twin(
    'A.tw.5j',
    'A',
    14,
    JR,
    'urgency',
    'b',
    msg('sms', 'Mum', 'Can you buy bread on the way home? Thanks!'),
    msg('sms', 'Unknown number', "Hi dear, it's Mum. I lost my phone, this is my new number. Send me the code that just came to your phone. Quick ah!"),
    'A "new number" plus a rush for your code is a common trick. Check by calling Mum on her usual number or asking at home.',
  ),
  twin(
    'A.tw.6j',
    'A',
    15,
    JR,
    'too-good',
    'a',
    msg('email', 'EduPass Prize Team', "Your class won a tablet! Send your home address and a parent's card number to claim it."),
    msg('app', 'EduPass', 'Reminder: Robotics Club meets in the lab at 3pm today.'),
    "Real prizes never need a parent's card number. Asking for it is how the trick makes money.",
  ),
  twin(
    'A.tw.4o',
    'A',
    13,
    OLDER,
    'small-ask',
    'a',
    msg('chat', 'QuikGig Recruiter', 'Earn $800 a week doing simple data entry from home! No interview. Pay a $30 starter fee today to unlock your first tasks.'),
    msg('app', 'QuikGig', "Your application for 'Weekend cafe helper' was viewed. The employer will reply in the QuikGig app."),
    "A real job pays you; it doesn't charge you to start. The small fee is the first step of a bigger ask.",
  ),
  twin(
    'A.tw.5o',
    'A',
    14,
    OLDER,
    'urgency',
    'b',
    msg('sms', 'Harbour Bank', "A card payment of $12.50 was made at MiniMart 24. If this wasn't you, call the number on the back of your card."),
    msg('sms', 'Harbour Bank', 'Unusual login on your account. Verify within 30 minutes or it will be suspended: harbourbank-secure.test'),
    'Banks tell you to call the number on your card, not to tap a link. The 30-minute deadline is there to stop you checking.',
  ),
  twin(
    'A.tw.6o',
    'A',
    15,
    OLDER,
    'fake-proof',
    'a',
    msg('chat', 'Buyer on Barang Market', "I've paid already, see my screenshot! Tap barang-escrow.test and enter your bank login to release the money."),
    msg('chat', 'Buyer on Barang Market', 'Hi, is the desk lamp still available? Can I collect on Saturday and pay in person?'),
    'A screenshot from the buyer is proof they control. Real payments never need your bank login to "release" them.',
  ),
  flags('A.fl.j', 'A', JR, { channel: 'game', from: 'LegendsAdmin_Official' }, [
    ['Hi player!'],
    ['Thanks for playing Lumen Legends.'],
    ['You won 10,000 free gems!', 'too-good'],
    ['To get them, log in at legends-gems.test', 'link'],
    ['with your password', 'data'],
    ['in the next 5 minutes.', 'urgency'],
    ['Have a great day!'],
  ]),
  flags('A.fl.o', 'A', OLDER, { channel: 'chat', from: 'Kelvin (HR team)' }, [
    ['Hiring now: part-time admin assistant.'],
    ['Pay is $150 an hour,', 'too-good'],
    ['no interview needed.', 'too-good'],
    ['You can work from home on weekdays.'],
    ['Send us your bank login so we can pay your salary.', 'data'],
    ['Reply within 1 hour, only 3 spots left!', 'urgency'],
    ['Thanks, Kelvin'],
  ]),
  choice(
    'A.dc.1j',
    'A',
    30,
    JR,
    'decide',
    "At the playground, an older teen Lina doesn't know says: \"Hold this bag for 10 minutes and I'll give you $20. Don't open it.\"",
    'What is the safest thing for Lina to do?',
    1,
    ["Hold it, but don't open it", 'Say no, and go to where her parent or another trusted adult is', 'Ask for $30 instead'],
  ),
  choice(
    'A.dc.2j',
    'A',
    31,
    JR,
    'decide',
    'In the class chat, someone posts an edited, embarrassing picture of a classmate and writes: "Send this to everyone, it\'s so funny!"',
    'What is the safest thing for Ben to do?',
    0,
    ["Don't send it, and tell a teacher or trusted adult", 'Send it to just one friend', 'Add a laughing sticker so he fits in'],
  ),
  choice(
    'A.dc.3j',
    'A',
    32,
    JR,
    'decide',
    'While Tara plays a game, a pop-up appears: "Your tablet has a virus! Tap here to clean it now."',
    'What should Tara do?',
    2,
    ['Tap it quickly to clean the tablet', "Type a parent's email so they can help", 'Close the game without tapping, and tell a parent'],
  ),
  choice(
    'A.dc.1o',
    'A',
    30,
    OLDER,
    'decide',
    'Haikal sees a QuikGig post: "$300 a week to receive parcels at home and drop them at a locker. We send the labels, you just drop them off."',
    "What is Haikal's safest move?",
    1,
    ['Try one parcel to see if it is real', 'Decline, and report the post in the app', 'Ask for the money upfront first', 'Pass the job to a friend who needs cash'],
  ),
  choice(
    'A.dc.2o',
    'A',
    31,
    OLDER,
    'decide',
    'Sofia gets a call: "This is Harbour Bank\'s fraud team. Your account has been hacked. Move your savings to this safe account now to protect it."',
    'What should Sofia do first?',
    2,
    [
      'Ask the caller for their staff ID before moving the money',
      'Move half the money, just in case',
      'Hang up, then call the number on the back of her card herself',
      'Move the money quickly, because the bank knows best',
    ],
  ),
  choice(
    'A.dc.3o',
    'A',
    32,
    OLDER,
    'decide',
    'An ad promises: "Turn $100 into $1,000 in a week with our trading bot. 3,000 members already!"',
    'What is the safest choice for Ravi?',
    0,
    [
      "Don't pay. Look the company up himself and talk to someone he trusts",
      'Start small with $20 to test it',
      "Join, because 3,000 members can't all be wrong",
      'Ask the group admin if it is real',
    ],
  ),
  choice(
    'A.cq.1j',
    'A',
    40,
    JR,
    'later',
    'Iman gave her Lumen Legends password to someone who promised her free gems.',
    LATER_DAYS,
    2,
    ['She gets the free gems the next day', 'Nothing, because she only shared it once', 'Someone logs in, takes her items, and may lock her out'],
    'days',
  ),
  choice(
    'A.cq.2j',
    'A',
    41,
    JR,
    'later',
    "Rohan used his mum's card to pay $5 for a \"prize\" he won online.",
    'Who could be affected later?',
    0,
    ['His mum, because the card details could be used for more payments', 'Nobody, because it was only $5', 'Only the prize company'],
    'who',
  ),
  choice(
    'A.cq.3j',
    'A',
    42,
    JR,
    'later',
    'Ana forwards a mean, edited picture of a classmate to one friend.',
    LATER_WEEKS,
    1,
    ['It stays with that one friend', 'The picture spreads, the classmate is hurt, and Ana is part of how it spread', 'Everyone forgets about it the next day'],
    'weeks',
  ),
  choice(
    'A.cq.1o',
    'A',
    40,
    OLDER,
    'later',
    'Shan sells his TaskLah account to a stranger for $150.',
    LATER_WEEKS,
    2,
    [
      'The stranger pays him again next month',
      "TaskLah closes the account and that's the end of it",
      "The account is used to cheat other people, and the reports lead back to Shan's details",
      'Nothing, because he deleted the app',
    ],
    'weeks',
  ),
  choice(
    'A.cq.2o',
    'A',
    41,
    OLDER,
    'later',
    'Yi Xuan pays a $30 "starter fee" for a work-from-home job.',
    LATER_DAYS,
    0,
    ['She is asked for a bigger "upgrade fee" before any pay arrives', 'Her first pay arrives', 'The fee is refunded automatically', 'A job contract arrives by post'],
    'days',
  ),
  choice(
    'A.cq.3t',
    'A',
    42,
    TEEN,
    'later',
    'Josh agrees to be the lookout while older teens take a bike from the rack outside the library. He never touches the bike.',
    'What is most likely to happen later?',
    3,
    [
      "He's fine, because he didn't touch the bike",
      'Only the bike owner has a problem',
      'Nobody will check the cameras',
      'He can be in trouble too, because helping is taking part',
    ],
    'weeks',
  ),
  choice(
    'A.cq.3y',
    'A',
    42,
    YA,
    'later',
    'Hui Min opens a bank account for an online "employer", who asks her to post them the card "for payroll".',
    LATER_WEEKS,
    1,
    [
      'She gets paid on time',
      'Stolen money moves through the account in her name, and she may be investigated',
      'The bank sorts it out without her',
      'Nothing, because she can close it any time',
    ],
    'weeks',
  ),
  choice(
    'A.pj.j',
    'A',
    50,
    JR,
    'friend',
    'Your friend Omar says: "Someone in the game will give me 1,000 gems if I tell them my password. Should I?"',
    BEST_SAY,
    1,
    ['"Do it fast before the offer ends!"', '"Wait! Real gifts never need your password. Let\'s ask a grown-up."', '"That\'s your problem, not mine."'],
  ),
  choice(
    'A.pj.o',
    'A',
    50,
    OLDER,
    'friend',
    'Your friend Amir says he will let someone use his bank account "just once" for $200.',
    'What is the best thing to say first?',
    3,
    [
      '"Easy money, go for it."',
      '"Do it, but don\'t tell anyone."',
      '"Your call, not my business."',
      '"Hold on. Who\'s asking, and why your account? \'Just once\' is how these start. Let\'s check first."',
    ],
  ),
];

// Form B ---------------------------------------------------------------------------------------

const FORM_B: AssessmentItem[] = [
  twin(
    'B.tw.1',
    'B',
    10,
    ALL,
    'secrecy',
    'b',
    msg('chat', 'Rina (ChatLah)', 'hey are you coming to badminton at 4? coach says bring water'),
    msg('chat', 'Rina (ChatLah)', "hey I'm locked out of my account, can you send me the code that just came to your phone? urgent pls, don't tell anyone"),
    "When a friend's account suddenly asks for your code and for secrecy, someone else may be using it. Check with your friend another way.",
  ),
  twin(
    'B.tw.2',
    'B',
    11,
    ALL,
    'urgency',
    'a',
    msg('email', 'EduPass', 'Your EduPass will be deleted today. Confirm your password at edupass-confirm.test to keep your school account.'),
    msg('app', 'EduPass', 'Your timetable for next term is ready. Sign in through the EduPass app to see it.'),
    'Threatening to delete your account today is a rush tactic. Real notices tell you to use the official app.',
  ),
  twin(
    'B.tw.3',
    'B',
    12,
    ALL,
    'everyone-does-it',
    'b',
    msg('sms', 'CityPass', 'Your CityPass card was topped up with $10.00. New balance: $14.30.'),
    msg('chat', 'CityPass Rewards', "FREE $100 CityPass credit for all students! Everyone's getting it. Share this to 10 chats to unlock yours."),
    '"Everyone\'s getting it" and "share to 10 chats" spread the trick through your friends. Real credit never needs sharing.',
  ),
  twin(
    'B.tw.4j',
    'B',
    13,
    JR,
    'fear',
    'a',
    msg('chat', 'Ash (ChatLah)', 'OMG is this you in this video?? lumen-vid.test/watch'),
    msg('game', 'Lumen Legends', 'Your friend Ash is now online. Say hi in the game!'),
    '"Is this you?" links play on worry so you tap without thinking. Ask your friend another way first.',
  ),
  twin(
    'B.tw.5j',
    'B',
    14,
    JR,
    'secrecy',
    'b',
    msg('app', 'Boba Boleh', 'Our drawing contest is open! Ask a parent to help you enter at any Boba Boleh shop.'),
    msg('chat', 'Boba Boleh Contest', "You won! Pay $5 with a gift card to get your prize. Don't tell your parents, it's a surprise!"),
    'Being told to hide it from your parents is a big warning sign. Real prizes are never secret or paid for.',
  ),
  twin(
    'B.tw.6j',
    'B',
    15,
    JR,
    'everyone-does-it',
    'a',
    msg('game', 'Trader SkyKing (player)', "Give me your rare pet first and I'll give you 2 back later. Trust me, everyone trades this way."),
    msg('game', 'Lumen Legends', 'Trade complete! You swapped a Blue Kite for a Star Hat in the Trade Window.'),
    '"Give first, trust me" trades happen outside the safe Trade Window. "Everyone does it" is pressure, not proof.',
  ),
  twin(
    'B.tw.4o',
    'B',
    13,
    OLDER,
    'urgency',
    'a',
    msg('chat', 'Seller on ChatLah', "Last 2 tickets for Saturday's football final! Half price, but transfer $120 now, 10 people are waiting."),
    msg('app', 'Lumen Arena', "Your e-tickets for Saturday's football final are in the Lumen Arena app under My Tickets. Don't share the QR code."),
    'Half price plus "10 people are waiting" is there to rush the transfer before you can check.',
  ),
  twin(
    'B.tw.5o',
    'B',
    14,
    OLDER,
    'small-ask',
    'b',
    msg('app', 'TaskLah', "Your payout of $45.00 for 'Help move boxes' will reach your bank in 1-2 working days."),
    msg('sms', 'TaskLah Payments', 'Your $45 payout is stuck. Pay a $9.90 unlock fee within 2 hours at tasklah-payout.test'),
    "Paying a fee to receive money is the trick. Real payouts don't cost you anything.",
  ),
  twin(
    'B.tw.6o',
    'B',
    15,
    OLDER,
    'fake-proof',
    'a',
    msg('chat', 'Investment Mentor', 'My students made 30% in one week! Screenshots attached. Join my VIP group before it closes tonight.'),
    msg('app', 'Harbour Bank', 'Your fixed deposit of $500 matures on 12 Nov. Renew it in the Harbour Bank app or at any branch.'),
    "Screenshots of profits are easy to fake, and real investments don't promise 30% a week.",
  ),
  flags('B.fl.j', 'B', JR, { channel: 'chat', from: 'Ash (ChatLah)' }, [
    ["Hey, it's Ash!"],
    ['My account got locked.'],
    ['Send me the 6-digit code on your phone', 'data'],
    ["and don't tell anyone, ok?", 'secrecy'],
    ['Quick quick!!', 'urgency'],
    ['See you at school tomorrow.'],
  ]),
  flags('B.fl.o', 'B', OLDER, { channel: 'chat', from: 'Buyer on Barang Market' }, [
    ['Hi, I want to buy your camera.'],
    ['I already paid, see my screenshot.', 'fake-proof'],
    ['Tap barang-pay.test to receive the money', 'link'],
    ['and enter your Harbour Bank login there.', 'data'],
    ['Can I collect on Sunday?'],
    ["Do it in 10 minutes or I'll buy another one.", 'urgency'],
    ['Thanks!'],
  ]),
  choice(
    'B.dc.1j',
    'B',
    30,
    JR,
    'decide',
    'Someone in a game chat says they will give Mia a rare pet if she tells them her home address, "so I can post you a real toy too".',
    'What should Mia do?',
    2,
    ['Share only her street name', 'Ask them to send the pet first', "Don't share it, block them, and tell a trusted adult"],
  ),
  choice(
    'B.dc.2j',
    'B',
    31,
    JR,
    'decide',
    'Leo gets a message: "Your EduPass will be locked. Reply with your password now." It looks real.',
    'What should Leo do?',
    0,
    ["Don't reply, and ask a teacher or parent to check", "Reply quickly so he doesn't lose his homework", 'Forward it to the class chat'],
  ),
  choice(
    'B.dc.3j',
    'B',
    32,
    JR,
    'decide',
    'An older kid at the void deck asks Zoe to buy a game top-up card with her own money. "I\'ll pay you back double tomorrow!"',
    'What is the safest choice for Zoe?',
    1,
    ['Buy a small card to test them', 'Say no, and keep her money', 'Give them her card number instead'],
  ),
  choice(
    'B.dc.1o',
    'B',
    30,
    OLDER,
    'decide',
    'A stranger online offers Bala $200 to collect a bag from a locker and bring it to another part of the city. "No questions, easy job."',
    "What is Bala's safest move?",
    3,
    [
      "Do it once and check what's inside",
      'Ask for more money first',
      'Bring a friend along to be safe',
      "Refuse. He doesn't know what's in the bag, and he could be blamed for it",
    ],
  ),
  choice(
    'B.dc.2o',
    'B',
    31,
    OLDER,
    'decide',
    "Chloe's online friend of three weeks says they are stuck overseas and need $300 for a flight. They promise to pay back double.",
    'What should Chloe do?',
    0,
    [
      "Don't send money, and talk it through with someone she trusts",
      'Send a smaller amount to help',
      'Send it if they share a photo of their passport',
      "Send it, because they've chatted for weeks",
    ],
  ),
  choice(
    'B.dc.3o',
    'B',
    32,
    OLDER,
    'decide',
    'A seller on Barang Market offers a phone at half price, but wants to finish the deal on ChatLah "to avoid fees".',
    'What is the safest choice for Faiz?',
    1,
    [
      'Move to ChatLah to save money',
      "Stay with the app's checkout, or meet in a busy public place and pay in person",
      'Pay a small deposit to hold the phone',
      'Ask for more photos, then transfer the money',
    ],
  ),
  choice(
    'B.cq.1j',
    'B',
    40,
    JR,
    'later',
    'Aiden taps a link that says "You won a free phone!" and types in his dad\'s email password.',
    LATER_DAYS,
    1,
    ['A free phone arrives', "Someone could get into his dad's email and other accounts", 'Nothing, because he closed the page'],
    'days',
  ),
  choice(
    'B.cq.2j',
    'B',
    41,
    JR,
    'later',
    'An online friend asks Ella to keep their chats a secret from her parents, and she agrees.',
    'What could happen later?',
    0,
    ['It becomes harder for her to get help if the chats turn unsafe', 'Her parents will be happier', 'Keeping secrets makes online friends safer'],
    'weeks',
  ),
  choice(
    'B.cq.3j',
    'B',
    42,
    JR,
    'later',
    'Ming\'s friends dare him to spray paint the void deck wall "just for fun".',
    'Who could be affected later?',
    2,
    ['Nobody, because no one will find out', 'Only the wall', 'Ming and his family, and the neighbours who use the void deck'],
    'who',
  ),
  choice(
    'B.cq.1o',
    'B',
    40,
    OLDER,
    'later',
    'Daniel posts a photo of his new CityPass card online to show off the design. The card number is easy to read.',
    'What could happen later?',
    2,
    [
      'Nothing, because card numbers are useless on their own',
      'CityPass sends him a reward',
      'Someone copies the number and uses it to pretend to be him',
      'His followers get the same design',
    ],
    'weeks',
  ),
  choice(
    'B.cq.2o',
    'B',
    41,
    OLDER,
    'later',
    'Wen joins a chat group that shares "investment tips" with screenshots of big profits, and puts in $100.',
    LATER_WEEKS,
    0,
    [
      "She is shown fake profits, pushed to add more, and then can't take her money out",
      'She doubles her money and leaves',
      'The group refunds anyone who asks',
      'Nothing, because small amounts are always safe',
    ],
    'weeks',
  ),
  choice(
    'B.cq.3t',
    'B',
    42,
    TEEN,
    'later',
    'Sam lets an online friend he has never met "borrow" his ChatLah account to join a group.',
    'What could happen later?',
    1,
    [
      'The friend gives it back with more followers',
      'Messages sent from his account could trick or hurt people, and they look like they came from Sam',
      'ChatLah gives him a badge for sharing',
      "Nothing, because it's just one group",
    ],
    'weeks',
  ),
  choice(
    'B.cq.3y',
    'B',
    42,
    YA,
    'later',
    'Arif signs up for a phone contract for a friend, who promises to pay the monthly bill.',
    'What is most likely to happen a few months later?',
    3,
    [
      'The phone company bills the friend instead',
      'The contract cancels itself',
      'Nothing changes for Arif',
      'The friend stops paying, and the debt and reminder calls come to Arif',
    ],
    'weeks',
  ),
  choice(
    'B.pj.j',
    'B',
    50,
    JR,
    'friend',
    'Your friend looks worried. She says a stranger online told her to keep their chats secret.',
    BEST_SAY,
    2,
    [
      '"Just block them and don\'t tell anyone."',
      '"Keep chatting, they seem nice."',
      '"Thanks for telling me. Secrets like that are a warning sign. Let\'s tell a trusted adult together."',
    ],
  ),
  choice(
    'B.pj.o',
    'B',
    50,
    OLDER,
    'friend',
    'Your friend is panicking: "The bank just called. I have to move my money in 10 minutes!"',
    'What is the best thing to say first?',
    0,
    [
      '"Stop. Hang up, and let\'s call the number on your card together."',
      '"Quick, do what they say."',
      '"Move only half."',
      '"Ask them to prove it with a photo of their staff pass."',
    ],
  ),
];

// Form C (Return visit) ------------------------------------------------------------------------

const FORM_C: AssessmentItem[] = [
  twin(
    'C.tw.1',
    'C',
    10,
    ALL,
    'fear',
    'a',
    msg('sms', 'LumenPay', 'Someone sent you $15.00 by mistake. Refund it to 8XXX XXXX right now or your account will be frozen.'),
    msg('app', 'LumenPay', 'You received $15.00 from Aunty Rose. Open the LumenPay app to see the details.'),
    '"Refund the mistake or be frozen" uses fear. Check your balance in the real app, and never send money to a number in a message.',
  ),
  twin(
    'C.tw.2',
    'C',
    11,
    ALL,
    'authority',
    'b',
    msg('game', 'Lumen Legends', 'Jo sent you a friend request. Accept or ignore it in your Friends list.'),
    msg('email', 'Lumen Legends Support', 'Your account was reported for cheating. Prove you are the owner at legends-support.test within 15 minutes or be banned.'),
    'Pretending to be "Support" and threatening a ban are pressure tools. Real game support works inside the game.',
  ),
  twin(
    'C.tw.3',
    'C',
    12,
    ALL,
    'too-good',
    'a',
    msg('chat', 'ChatLah Stickers', 'Get ALL paid sticker packs free! Enter your ChatLah phone number and password at chatlah-stickers.test'),
    msg('app', 'ChatLah', "New free sticker pack 'Lumen Cats' is now in the Sticker Shop."),
    'Free paid stuff in exchange for your password is a trade you always lose. Free things in the real shop need no password.',
  ),
  twin(
    'C.tw.4j',
    'C',
    13,
    JR,
    'too-good',
    'b',
    msg('game', 'Lumen Legends', "You spun today's free Lucky Wheel and won 20 coins!"),
    msg('chat', 'Lucky Wheel', "You won a new phone! Pay $2 delivery with a parent's card at luckyspin.test in the next 5 minutes."),
    'Winning something big, then paying "just $2" with a parent\'s card, is how the trick gets card details.',
  ),
  twin(
    'C.tw.5j',
    'C',
    14,
    JR,
    'too-good',
    'a',
    msg('chat', 'HomeworkHero', 'Get all the answers free! Download our app from homeworkhero.test and let it see your contacts.'),
    msg('app', 'EduPass', 'Your teacher posted new Science homework. Open EduPass to see it.'),
    "An app that wants your contacts for \"free answers\" is after your friends' details. Only install apps a parent has checked.",
  ),
  twin(
    'C.tw.6j',
    'C',
    15,
    JR,
    'authority',
    'b',
    msg('chat', 'Pei Shan (class chat)', "Who's bringing snacks for Friday's class party?"),
    msg('chat', 'Lumen Legends Moderator', "I'm a game moderator. Send me your password so I can give you a special badge. Keep it secret, ok?"),
    'Real moderators never ask for your password, and "keep it secret" is a warning sign on its own.',
  ),
  twin(
    'C.tw.4o',
    'C',
    13,
    OLDER,
    'too-good',
    'b',
    msg('app', 'Lumen Hostel', 'Your room booking is confirmed. Pay at check-in or in our official app.'),
    msg('chat', 'Room for rent (Barang Market)', "Big room, very cheap! I'm overseas now, so transfer the $600 deposit first and I'll post you the keys."),
    'A cheap room you cannot view, and an "overseas" owner who wants the deposit first, is a common rental trick.',
  ),
  twin(
    'C.tw.5o',
    'C',
    14,
    OLDER,
    'small-ask',
    'a',
    msg('email', 'Lumen Scholarship Board', "You've been pre-approved for $2,000! Pay a $50 processing fee today to secure your place."),
    msg('app', 'EduPass', 'Applications for the Lumen Bursary close on 30 Nov. Apply in EduPass. There is no fee to apply.'),
    'Real bursaries never charge you to receive money. The "small fee" is the scam\'s payday.',
  ),
  twin(
    'C.tw.6o',
    'C',
    15,
    OLDER,
    'too-good',
    'b',
    msg('chat', 'Boba Boleh (verified)', "Thanks for tagging us! We've shared your post on our page."),
    msg('chat', 'Brand Partnerships', "We love your page! Become a Boba Boleh ambassador. Just buy our $80 starter kit first and we'll pay you back double."),
    '"Buy first, we\'ll pay you back double" turns you into the customer. Real brand deals pay you.',
  ),
  flags('C.fl.j', 'C', JR, { channel: 'sms', from: 'MiniMart 24 Lucky Draw' }, [
    ['Hello from MiniMart 24!'],
    ['Congratulations, you won a game console!', 'too-good'],
    ['Just pay $2 for delivery', 'small-ask'],
    ["using a parent's card.", 'data'],
    ['This offer ends in 10 minutes.', 'urgency'],
    ['Thank you for shopping with us.'],
  ]),
  flags('C.fl.o', 'C', OLDER, { channel: 'sms', from: 'Harbour Bank' }, [
    ['Harbour Bank:'],
    ['Your account has been suspended.', 'fear'],
    ['Verify within 30 minutes', 'urgency'],
    ['at harbour-verify.test', 'link'],
    ['Do not tell anyone about this security check.', 'secrecy'],
    ['Thank you for banking with us.'],
  ]),
  choice(
    'C.dc.1j',
    'C',
    30,
    JR,
    'decide',
    'At the MRT station, a stranger asks Naveen if he can borrow his phone "to call my mum".',
    'What is the safest thing for Naveen to do?',
    1,
    ['Hand over the phone and wait', 'Keep his phone, and point the stranger to the station staff', 'Lend the phone and walk away'],
  ),
  choice(
    'C.dc.2j',
    'C',
    31,
    JR,
    'decide',
    'When Kelly signs up for a video app, it says: "Turn on your location so friends can find you!"',
    'What should Kelly do?',
    0,
    ['Leave location off, and ask a parent about the settings', 'Turn it on, because everyone does', "Put her school's name in her profile instead"],
  ),
  choice(
    'C.dc.3j',
    'C',
    32,
    JR,
    'decide',
    'In a group chat, some kids plan to "teach someone a lesson" after school. They ask Siti to come and film it.',
    'What is the safest choice for Siti?',
    2,
    ['Go, but only to watch', "Film it but don't post it", "Don't go, and tell a teacher or trusted adult so nobody gets hurt"],
  ),
  choice(
    'C.dc.1o',
    'C',
    30,
    OLDER,
    'decide',
    "Fiona's cousin asks her to open a TaskLah account in her name for him, because his own account was banned.",
    "What is Fiona's safest move?",
    1,
    [
      'Open it, but keep the password herself',
      'Say no. An account in her name is her responsibility, and he can contact TaskLah support',
      'Open it if he pays her',
      'Let him use only her phone number',
    ],
  ),
  choice(
    'C.dc.2o',
    'C',
    31,
    OLDER,
    'decide',
    'Someone keeps posting mean comments about a classmate in a group chat, and others are joining in.',
    'What is the best thing for Zack to do?',
    3,
    [
      "Stay quiet so he isn't next",
      'Reply with something meaner to the poster',
      'Leave the group without telling anyone',
      "Don't join in, check on the classmate privately, and report the posts or tell a trusted adult",
    ],
  ),
  choice(
    'C.dc.3o',
    'C',
    32,
    OLDER,
    'decide',
    'A gaming friend asks Ken to test a "beta game" by downloading a file from a link and logging in with his real game account.',
    "What is Ken's safest move?",
    0,
    [
      "Don't download it. Only install from the official app store, and keep his login to himself",
      "Download it on a family member's phone instead",
      'Try it with an old account',
      'Share his login so the friend can set it up',
    ],
  ),
  choice(
    'C.cq.1j',
    'C',
    40,
    JR,
    'later',
    'Nora installs an app that promised free stickers, and lets it read her contacts.',
    LATER_DAYS,
    2,
    ['She gets new stickers every day', 'The app only uses her contacts to say hi', 'Her friends start getting scam messages from it'],
    'days',
  ),
  choice(
    'C.cq.2j',
    'C',
    41,
    JR,
    'later',
    "Imran uses his own money to buy game credits for a stranger, who says they'll pay him back double tomorrow.",
    'What is most likely to happen?',
    0,
    ['The stranger disappears, and Imran loses his money', 'He gets double back the next day', 'The stranger becomes his best friend'],
    'days',
  ),
  choice(
    'C.cq.3j',
    'C',
    42,
    JR,
    'later',
    'Lily turns on "show my live location" in her public game profile.',
    'Who could see where she is?',
    1,
    ['Only her best friends', 'Strangers playing the game, too', "Nobody, it's just for the game"],
    'who',
  ),
  choice(
    'C.cq.1o',
    'C',
    40,
    OLDER,
    'later',
    "Huda gives the 6-digit login code on her phone to someone who says they're from ChatLah support.",
    LATER_DAYS,
    3,
    [
      'ChatLah support fixes her account',
      'Nothing, because codes run out quickly',
      'Her account gets a verified badge',
      'They take over her account and message her friends asking for money',
    ],
    'days',
  ),
  choice(
    'C.cq.2o',
    'C',
    41,
    OLDER,
    'later',
    'Kenji films a fight at school and posts it "for views".',
    'What is most likely to happen later?',
    0,
    [
      'The video spreads, the student in it is hurt all over again, and Kenji may face school or police action',
      'He becomes popular with no downside',
      'The video disappears after a day',
      'Only the students who were fighting are responsible',
    ],
    'weeks',
  ),
  choice(
    'C.cq.3t',
    'C',
    42,
    TEEN,
    'later',
    'Gabriel enters his mum\'s phone number, and then the code sent to it, to get "free" game currency.',
    'What is most likely to happen next month?',
    2,
    [
      'He gets free currency every month at no cost',
      'The game sends his mum a thank-you gift',
      "His mum's phone bill shows a monthly charge for a subscription",
      'Nothing, because the code expires',
    ],
    'weeks',
  ),
  choice(
    'C.cq.3y',
    'C',
    42,
    YA,
    'later',
    'Ahmad applies for a "crypto job" that asks him to verify himself with a photo of his CityPass card and a selfie.',
    LATER_WEEKS,
    1,
    [
      'He starts work the next Monday',
      'His identity is used to open accounts or loans in his name',
      'The photos are deleted after the check',
      'Nothing, because a selfie is not personal data',
    ],
    'weeks',
  ),
  choice(
    'C.pj.j',
    'C',
    50,
    JR,
    'friend',
    "Your friend is about to pay for a \"prize\" using his dad's card.",
    BEST_SAY,
    1,
    ['"Pay quickly before it ends!"', '"Hold on. Prizes you have to pay for are a trick. Let\'s show your dad first."', '"Use your own money instead."'],
  ),
  choice(
    'C.pj.o',
    'C',
    50,
    OLDER,
    'friend',
    'Your friend got a job offer: "$150 an hour, just send us your bank login for your salary." She is excited.',
    BEST_SAY,
    2,
    [
      '"Send it fast before someone else gets the job."',
      '"Send just your username for now."',
      '"That sounds great, but real jobs never need your bank login. Let\'s check the company together first."',
      '"Ask them to pay you first."',
    ],
  ),
];

// Shared scales, feedback and the jammed Freeze -----------------------------------------------

const SURE_PROMPT = 'How sure are you that you could…';

function likert(
  id: string,
  order: number,
  kinds: readonly AssessmentKind[],
  kpi: AssessmentKpiId,
  scale: LikertScale,
  prompt: string,
  statement: string,
): LikertItem {
  const section: AssessmentSectionId = kpi === 'peer' ? 'sure' : 'feedback';
  return { id, type: 'likert', form: '*', order, bands: ALL, kinds, kpi, section, prompt, statement, scale };
}

const POST: readonly AssessmentKind[] = ['post'];
const RETURN: readonly AssessmentKind[] = ['return'];
const AGREE_PROMPT = 'How much do you agree?';

const SHARED: AssessmentItem[] = [
  likert('P.cf.1', 60, EVERY_KIND, 'peer', 'sure', SURE_PROMPT, '…tell when a friend is being pressured into something risky?'),
  likert('P.cf.2', 61, EVERY_KIND, 'peer', 'sure', SURE_PROMPT, '…help a friend pause and check before they reply to a suspicious message?'),
  likert('P.cf.3', 62, EVERY_KIND, 'peer', 'sure', SURE_PROMPT, '…get help from a trusted adult if a friend was in trouble?'),
  likert('E.1', 80, POST, 'engagement', 'agree', AGREE_PROMPT, 'ShieldQuest was fun to play.'),
  likert('E.2', 81, POST, 'engagement', 'agree', AGREE_PROMPT, 'It was easy to know what to do.'),
  likert('E.3', 82, POST, 'engagement', 'agree', AGREE_PROMPT, 'The situations felt like things that could happen to people my age.'),
  likert('E.4', 83, POST, 'engagement', 'agree', AGREE_PROMPT, 'I learned something I can use in real life.'),
  likert('E.5', 84, POST, 'engagement', 'agree', AGREE_PROMPT, 'I felt comfortable and safe while playing.'),
  {
    id: 'E.again',
    type: 'poll',
    form: '*',
    order: 85,
    bands: ALL,
    kinds: POST,
    kpi: 'engagement',
    section: 'feedback',
    question: 'Would you play ShieldQuest again?',
    options: [
      { id: 'yes', text: 'Yes', value: 1 },
      { id: 'maybe', text: 'Maybe', value: 0.5 },
      { id: 'no', text: 'No', value: 0 },
    ],
  },
  {
    id: 'E.reflect',
    type: 'chips',
    form: '*',
    order: 90,
    bands: ALL,
    kinds: POST,
    kpi: 'engagement',
    section: 'feedback',
    question: 'What will you try next time someone pressures you? Pick any that fit.',
    chips: [
      { id: 'pause', text: 'Pause before I reply' },
      { id: 'check', text: 'Check it myself in the official app or website' },
      { id: 'ask', text: 'Ask someone I trust' },
      { id: 'say-no', text: 'Say no, even to a friend' },
      { id: 'help-friend', text: 'Help a friend slow down' },
      { id: 'guard', text: 'Keep my codes and passwords to myself' },
      { id: 'report', text: 'Report it' },
    ],
  },
  {
    id: 'R.jam.j',
    type: 'jammed',
    form: 'C',
    order: 5,
    bands: JR,
    kinds: RETURN,
    kpi: 'retention',
    section: 'jammed',
    message: msg('game', 'Lumen Legends Admin', 'Your account will be DELETED in 1 minute! Reply with the code we just sent you to keep it.'),
    question: "HOLD didn't work. Out here, time doesn't freeze. What do you do right now?",
    options: options(1, [
      'Reply with the code fast, before the minute is up',
      'Put the phone face down, stop replying, and tell someone',
      "Reply and ask if it's really them",
    ]),
    tellQuestion: 'Who would you tell? Pick any.',
    tell: [
      { id: 'home', text: 'A parent or someone I live with', trusted: true },
      { id: 'school', text: 'A teacher or school counsellor', trusted: true },
      { id: 'friend', text: 'A friend', trusted: true },
      { id: 'official', text: 'Lumen Legends, through the help page inside the game', trusted: true },
      { id: 'sender', text: 'The person who sent the message', trusted: false },
      { id: 'nobody', text: "Nobody, I'd sort it out myself", trusted: false },
    ],
  },
  {
    id: 'R.jam.o',
    type: 'jammed',
    form: 'C',
    order: 5,
    bands: OLDER,
    kinds: RETURN,
    kpi: 'retention',
    section: 'jammed',
    message: msg('sms', 'LumenPay', 'Your LumenPay account will be LOCKED in 2 minutes. Reply with the 6-digit code we just sent to keep it open.'),
    question: "HOLD didn't work. Out here, time doesn't freeze. What do you do right now?",
    options: options(0, [
      'Put the phone face down, stop replying, and tell someone',
      'Reply with the code quickly, two minutes is not long',
      'Call the number in the message to check',
      'Post a screenshot and ask followers what to do',
    ]),
    tellQuestion: 'Who would you tell? Pick any.',
    tell: [
      { id: 'home', text: 'Someone at home', trusted: true },
      { id: 'school', text: 'A teacher, lecturer or counsellor', trusted: true },
      { id: 'friend', text: 'A friend', trusted: true },
      { id: 'official', text: 'LumenPay, through the official app I open myself', trusted: true },
      { id: 'sender', text: 'The number in the message', trusted: false },
      { id: 'nobody', text: "Nobody, I'd handle it alone", trusted: false },
    ],
  },
];

/** Every item in the bank (all forms, bands and kinds). */
export const ASSESSMENT_ITEMS: readonly AssessmentItem[] = [...FORM_A, ...FORM_B, ...FORM_C, ...SHARED];

const ITEM_INDEX = new Map(ASSESSMENT_ITEMS.map((i) => [i.id, i]));
export const assessmentItemById = (id: string): AssessmentItem | undefined => ITEM_INDEX.get(id);

/** The items one person answers, in display order. */
export function assessmentItems(kind: AssessmentKind, band: BandId, form: AssessmentForm): AssessmentItem[] {
  return ASSESSMENT_ITEMS.filter(
    (i) => (i.form === form || i.form === '*') && i.bands.includes(band) && i.kinds.includes(kind),
  ).sort((a, b) => a.order - b.order);
}

/** Seconds a typical player needs per item type (piloted estimates; used for the "about N minutes" label). */
const ITEM_SECONDS: Record<AssessmentItemType, number> = {
  twin: 20,
  flags: 30,
  choice: 18,
  likert: 8,
  poll: 6,
  chips: 12,
  jammed: 50,
};

export function estimateMinutes(items: readonly AssessmentItem[]): number {
  return Math.max(1, Math.round(items.reduce((s, i) => s + ITEM_SECONDS[i.type], 0) / 60));
}

// ---------------------------------------------------------------------------------------------
// Codes and counterbalancing

/** 31 characters with no 0/O, 1/I or L, so codes survive being copied by hand. */
export const ASSESSMENT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Curated, friendly words (foods, fruits and animals). Squad totem animals are left out on purpose. */
export const ASSESSMENT_CODE_WORDS: readonly string[] = [
  'KAYA', 'ROTI', 'LAKSA', 'SATAY', 'TAHU', 'KUEH', 'BAO', 'TOFU', 'MANGO', 'DURIAN',
  'LYCHEE', 'PAPAYA', 'GUAVA', 'PEAR', 'PLUM', 'KIWI', 'LIME', 'LEMON', 'MELON', 'BERRY',
  'GRAPE', 'PEACH', 'APPLE', 'BANANA', 'PANDAN', 'ONDEH', 'PRATA', 'NASI', 'KOPI', 'BOBA',
  'MOCHI', 'SUSHI', 'UDON', 'RAMEN', 'TACO', 'PIZZA', 'PASTA', 'BAGEL', 'MUFFIN', 'WAFFLE',
  'CREPE', 'SCONE', 'TOAST', 'HONEY', 'MAPLE', 'COCOA', 'MINT', 'BASIL', 'GINGER', 'CHILLI',
  'SAMBAL', 'CURRY', 'OTAH', 'CHENDOL', 'SAGO', 'CASHEW', 'ALMOND', 'PEANUT', 'WALNUT', 'CORN',
  'BEAN', 'RICE', 'NOODLE', 'CHIVE', 'OLIVE', 'PRUNE', 'DATE', 'FIG', 'YUZU', 'MATCHA',
  'ORCA', 'OTTER', 'PANDA', 'KOALA', 'EGRET', 'TAPIR', 'LEMUR', 'GECKO', 'ROBIN', 'FINCH',
  'CRANE', 'SQUID', 'TURTLE', 'DOLPHIN', 'PENGUIN', 'BEAVER', 'BADGER', 'BISON', 'CAMEL', 'LLAMA',
  'ALPACA', 'MOOSE', 'ZEBRA', 'HIPPO', 'RHINO', 'TIGER', 'EAGLE', 'FALCON', 'PARROT', 'TOUCAN',
  'PUFFIN', 'PELICAN', 'MANTA', 'SEAL', 'WALRUS', 'YAK', 'IBIS', 'MYNAH', 'QUOKKA', 'WOMBAT',
  'GOOSE', 'SWAN', 'OWL', 'FOX', 'HARE', 'MOLE', 'NEWT', 'CRAB', 'SNAIL', 'KOI',
  'BELUGA', 'MARLIN', 'GIBBON', 'JAGUAR', 'OKAPI', 'SLOTH', 'TERN', 'WREN',
];

const SUFFIX_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{3}$/;
const CODE_RE = /^[A-Z]{3,8}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{3}$/;

interface CryptoLike {
  getRandomValues<T extends Uint32Array>(array: T): T;
}

function randomInts(count: number): number[] {
  const c = (globalThis as { crypto?: Partial<CryptoLike> }).crypto;
  if (c && typeof c.getRandomValues === 'function') return Array.from(c.getRandomValues(new Uint32Array(count)));
  // Last resort for very old browsers; the server issues codes with a cryptographic RNG whenever it is reachable.
  return Array.from({ length: count }, () => Math.floor(Math.random() * 0x1_0000_0000));
}

/**
 * A random pseudonymous code such as "KAYA-7K2": a word plus 3 characters with at least one digit
 * (so no suffix can spell a word). Uses crypto.getRandomValues when available.
 * `ints` is injectable for tests: it must return `count` unsigned 32-bit integers.
 */
export function makeAssessmentCode(ints: (count: number) => number[] = randomInts): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const [w = 0, x = 0, y = 0, z = 0] = ints(4);
    const word = ASSESSMENT_CODE_WORDS[w % ASSESSMENT_CODE_WORDS.length] ?? 'KAYA';
    const suffix = [x, y, z].map((n) => ASSESSMENT_CODE_ALPHABET[n % ASSESSMENT_CODE_ALPHABET.length]).join('');
    if (/[2-9]/.test(suffix)) return `${word}-${suffix}`;
  }
  return `KAYA-${ASSESSMENT_CODE_ALPHABET[0]}7${ASSESSMENT_CODE_ALPHABET[1]}`;
}

/** Tidies a typed code: "kaya 7k2", "KAYA7K2" and "kaya_7k2" all become "KAYA-7K2". */
export function normalizeAssessmentCode(input: string): string {
  let s = input.toUpperCase().trim().replace(/[\s_.–—]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s.includes('-')) {
    const m = /^([A-Z]{3,8})([A-Z0-9]{3})$/.exec(s);
    if (m) s = `${m[1]}-${m[2]}`;
  }
  return s.slice(0, 16);
}

export const isAssessmentCode = (code: string): boolean => CODE_RE.test(code) && SUFFIX_RE.test(code.slice(-3));

/** Explains what is wrong with a typed code, or returns null when it looks valid. */
export function assessmentCodeProblem(input: string): string | null {
  const code = normalizeAssessmentCode(input);
  if (!code) return 'Type the code from your slip, for example KAYA-7K2.';
  if (isAssessmentCode(code)) return null;
  const suffix = code.split('-')[1] ?? '';
  if (/[01OIL]/.test(suffix)) return 'Codes never use 0, O, 1, I or L after the dash. Check your slip again.';
  return 'That does not look like a code. Codes are a word, a dash and 3 characters, like KAYA-7K2.';
}

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Counterbalancing: the parity of the code's hash decides whether a person sees A or B first. */
export function assessmentFormFor(code: string, kind: AssessmentKind): AssessmentForm {
  if (kind === 'return') return 'C';
  const aFirst = fnv1a(normalizeAssessmentCode(code)) % 2 === 0;
  return (kind === 'pre') === aFirst ? 'A' : 'B';
}

// ---------------------------------------------------------------------------------------------
// Answer validation

const isStr = (v: unknown): v is string => typeof v === 'string';
const uniq = (xs: string[]): string[] => [...new Set(xs)];

/** Narrows one untrusted answer to a valid answer for this item, or null (treated as skipped). */
export function cleanAnswer(item: AssessmentItem, raw: unknown): AssessmentAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (a.type !== item.type) return null;
  switch (item.type) {
    case 'twin': {
      const pick = a.pick;
      if (pick !== 'a' && pick !== 'b' && pick !== 'both' && pick !== 'neither') return null;
      const c = a.confidence;
      return c === 1 || c === 2 || c === 3 ? { type: 'twin', pick, confidence: c } : { type: 'twin', pick };
    }
    case 'flags': {
      if (!Array.isArray(a.picked)) return null;
      const ids = new Set(item.segments.map((s) => s.id));
      return { type: 'flags', picked: uniq(a.picked.filter(isStr).filter((id) => ids.has(id))) };
    }
    case 'choice':
      return isStr(a.option) && item.options.some((o) => o.id === a.option) ? { type: 'choice', option: a.option } : null;
    case 'poll':
      return isStr(a.option) && item.options.some((o) => o.id === a.option) ? { type: 'poll', option: a.option } : null;
    case 'likert': {
      const v = a.value;
      return v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? { type: 'likert', value: v } : null;
    }
    case 'chips': {
      if (!Array.isArray(a.chips)) return null;
      const ids = new Set(item.chips.map((c) => c.id));
      const chips = uniq(a.chips.filter(isStr).filter((id) => ids.has(id)));
      return chips.length ? { type: 'chips', chips } : null;
    }
    case 'jammed': {
      const tellIds = new Set(item.tell.map((t) => t.id));
      const tell = Array.isArray(a.tell) ? uniq(a.tell.filter(isStr).filter((id) => tellIds.has(id))) : [];
      const option = isStr(a.option) && item.options.some((o) => o.id === a.option) ? a.option : undefined;
      if (!option && tell.length === 0) return null;
      return option ? { type: 'jammed', option, tell } : { type: 'jammed', tell };
    }
  }
}

/** Keeps only answers to items in this person's form, each narrowed by cleanAnswer. */
export function cleanAnswers(
  items: readonly AssessmentItem[],
  raw: Readonly<Record<string, unknown>>,
): { answers: AssessmentAnswers; dropped: number } {
  const answers: AssessmentAnswers = {};
  let dropped = 0;
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const [id, value] of Object.entries(raw)) {
    const item = byId.get(id);
    const clean = item ? cleanAnswer(item, value) : null;
    if (clean) answers[id] = clean;
    else dropped++;
  }
  return { answers, dropped };
}

// ---------------------------------------------------------------------------------------------
// Scoring

/** Inverse of the standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9). */
export function probit(p: number): number {
  if (!(p > 0)) return -Infinity;
  if (!(p < 1)) return Infinity;
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((-7.784894002430293e-3 * q - 3.223964580411365e-1) * q - 2.400758277161838) * q - 2.549732539343734) * q +
        4.374664141464968) *
        q +
        2.938163982698783) /
      ((((7.784695709041462e-3 * q + 3.224671290700398e-1) * q + 2.445134137142996) * q + 3.754408661907416) * q + 1)
    );
  }
  if (p > 1 - low) return -probit(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((-3.969683028665376e1 * r + 2.209460984245205e2) * r - 2.759285104469687e2) * r + 1.38357751867269e2) * r -
      3.066479806614716e1) *
      r +
      2.506628277459239) *
      q) /
    (((((-5.447609879822406e1 * r + 1.615858368580409e2) * r - 1.556989798598866e2) * r + 6.680131188771972e1) * r -
      1.328068155288572e1) *
      r +
      1)
  );
}

/**
 * Corrections that keep z finite when a rate is 0 or 1 (common with only 6 trials):
 * - 'loglinear' (Hautus, 1995): add 0.5 to each count and 1 to each total, always. Least biased; the default.
 * - 'half-n' (Macmillan & Kaplan, 1985): replace 0 with 0.5/n and 1 with (n - 0.5)/n, only at the extremes.
 */
export type SdtCorrection = 'loglinear' | 'half-n';

export interface SdtResult {
  hitRate: number;
  falseAlarmRate: number;
  /** Sensitivity: how well scams are told apart from genuine messages. 0 = chance. */
  dPrime: number;
  /** Criterion c: below 0 = calls things scams readily ("jumpy"); above 0 = lets scams through ("trusting"). */
  c: number;
}

function correctedRate(count: number, n: number, correction: SdtCorrection): number {
  if (correction === 'loglinear') return (count + 0.5) / (n + 1);
  if (count <= 0) return 0.5 / n;
  if (count >= n) return (n - 0.5) / n;
  return count / n;
}

export function signalDetection(
  hits: number,
  signalN: number,
  falseAlarms: number,
  noiseN: number,
  correction: SdtCorrection = 'loglinear',
): SdtResult {
  if (signalN <= 0 || noiseN <= 0) throw new Error('signalDetection needs at least one signal and one noise trial');
  const h = correctedRate(hits, signalN, correction);
  const f = correctedRate(falseAlarms, noiseN, correction);
  const zh = probit(h);
  const zf = probit(f);
  return { hitRate: hits / signalN, falseAlarmRate: falseAlarms / noiseN, dPrime: zh - zf, c: -(zh + zf) / 2 };
}

export type AssessmentMetricId =
  | 'dPrime'
  | 'twinAccuracy'
  | 'criterion'
  | 'hitRate'
  | 'falseAlarmRate'
  | 'twinConfidence'
  | 'confidentMiss'
  | 'flagHitRate'
  | 'flagFalseAlarmRate'
  | 'decisionAccuracy'
  | 'consequenceAccuracy'
  | 'peerConfidence'
  | 'peerJudgement'
  | 'knowledge'
  | 'jammedAction'
  | 'jammedTell'
  | 'engagement'
  | 'playAgain'
  | 'answered';

/** Numeric scores for one response. A metric is absent when none of its items were answered. */
export type AssessmentScores = Partial<Record<AssessmentMetricId, number>>;

const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const round = (x: number, dp = 4): number => Math.round(x * 10 ** dp) / 10 ** dp;

/** Scores one person's answers against their form. Server-authoritative: the client's own scores are never trusted. */
export function scoreAssessment(items: readonly AssessmentItem[], answers: AssessmentAnswers): AssessmentScores {
  const s: AssessmentScores = {};
  let answered = 0;

  let pairs = 0;
  let correct = 0;
  let hits = 0;
  let fas = 0;
  let confidentMiss = 0;
  const conf: number[] = [];
  let flagHits = 0;
  let flagN = 0;
  let plainFas = 0;
  let plainN = 0;
  const acc: Record<'decision' | 'consequence' | 'peer', number[]> = { decision: [], consequence: [], peer: [] };
  const peerLikert: number[] = [];
  const engagementLikert: number[] = [];

  for (const item of items) {
    const a = answers[item.id];
    if (!a || a.type !== item.type) continue;
    answered++;
    switch (item.type) {
      case 'twin': {
        if (a.type !== 'twin') break;
        pairs++;
        const genuine = item.scam === 'a' ? 'b' : 'a';
        const scamJudgedScam = a.pick === item.scam || a.pick === 'both';
        const genuineJudgedScam = a.pick === genuine || a.pick === 'both';
        if (scamJudgedScam) hits++;
        if (genuineJudgedScam) fas++;
        const right = a.pick === item.scam;
        if (right) correct++;
        if (a.confidence) {
          conf.push(a.confidence);
          if (!right && a.confidence === 3) confidentMiss++;
        }
        break;
      }
      case 'flags': {
        if (a.type !== 'flags') break;
        const picked = new Set(a.picked);
        for (const seg of item.segments) {
          if (seg.flag) {
            flagN++;
            if (picked.has(seg.id)) flagHits++;
          } else {
            plainN++;
            if (picked.has(seg.id)) plainFas++;
          }
        }
        break;
      }
      case 'choice': {
        if (a.type !== 'choice') break;
        const best = item.options.find((o) => o.best)?.id;
        const key = item.kpi === 'decision' ? 'decision' : item.kpi === 'consequence' ? 'consequence' : 'peer';
        acc[key].push(a.option === best ? 1 : 0);
        break;
      }
      case 'likert':
        if (a.type !== 'likert') break;
        (item.kpi === 'peer' ? peerLikert : engagementLikert).push(a.value);
        break;
      case 'poll': {
        if (a.type !== 'poll') break;
        const opt = item.options.find((o) => o.id === a.option);
        if (opt) s.playAgain = opt.value;
        break;
      }
      case 'chips':
        break;
      case 'jammed': {
        if (a.type !== 'jammed') break;
        if (a.option) s.jammedAction = item.options.find((o) => o.id === a.option)?.best ? 1 : 0;
        if (a.tell.length) {
          const chosen = item.tell.filter((t) => a.tell.includes(t.id));
          s.jammedTell = chosen.some((t) => t.trusted) && !chosen.some((t) => !t.trusted) ? 1 : 0;
        }
        break;
      }
    }
  }

  if (pairs > 0) {
    const sdt = signalDetection(hits, pairs, fas, pairs);
    s.twinAccuracy = round(correct / pairs);
    s.dPrime = round(sdt.dPrime);
    s.criterion = round(sdt.c);
    s.hitRate = round(sdt.hitRate);
    s.falseAlarmRate = round(sdt.falseAlarmRate);
    s.confidentMiss = round(confidentMiss / pairs);
    if (conf.length) s.twinConfidence = round(mean(conf));
  }
  if (flagN > 0) {
    s.flagHitRate = round(flagHits / flagN);
    if (plainN > 0) s.flagFalseAlarmRate = round(plainFas / plainN);
  }
  if (acc.decision.length) s.decisionAccuracy = round(mean(acc.decision));
  if (acc.consequence.length) s.consequenceAccuracy = round(mean(acc.consequence));
  if (acc.peer.length) s.peerJudgement = round(mean(acc.peer));
  if (peerLikert.length) s.peerConfidence = round(mean(peerLikert));
  if (engagementLikert.length) s.engagement = round(mean(engagementLikert));

  // One 0-1 knowledge index (all accuracy measures) so Return-vs-post retention reads as a single number.
  const knowledge = [s.twinAccuracy, s.decisionAccuracy, s.consequenceAccuracy, s.peerJudgement].filter(
    (x): x is number => x !== undefined,
  );
  if (knowledge.length) s.knowledge = round(mean(knowledge));
  if (items.length) s.answered = round(answered / items.length);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Responses

/** What the device sends. The server derives the form, the scores and the hour itself. */
export interface AssessmentSubmission {
  code: string;
  kind: AssessmentKind;
  band: BandId;
  /** Squad room code of the workshop session, when the link carried one. */
  sessionCode?: string;
  answers: AssessmentAnswers;
}

/** Stored only in the separate assessment collection; never joined to gameplay data. */
export interface AssessmentResponse {
  /** `${code}:${kind}`, so a retry or a re-take replaces the earlier answers. */
  id: string;
  code: string;
  kind: AssessmentKind;
  form: AssessmentForm;
  band: BandId;
  sessionCode?: string;
  /** ISO timestamp rounded down to the hour (never finer). */
  createdAtHour: string;
  answers: AssessmentAnswers;
  scores: AssessmentScores;
  version: number;
}

export const assessmentResponseId = (code: string, kind: AssessmentKind): string => `${code}:${kind}`;

export function toHourIso(ms: number): string {
  return new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
}

/** Builds the stored response: cleans the answers against the person's form and scores them. */
export function buildAssessmentResponse(sub: AssessmentSubmission, nowMs: number): { response: AssessmentResponse; dropped: number } {
  const code = normalizeAssessmentCode(sub.code);
  const form = assessmentFormFor(code, sub.kind);
  const items = assessmentItems(sub.kind, sub.band, form);
  const { answers, dropped } = cleanAnswers(items, sub.answers);
  const response: AssessmentResponse = {
    id: assessmentResponseId(code, sub.kind),
    code,
    kind: sub.kind,
    form,
    band: sub.band,
    createdAtHour: toHourIso(nowMs),
    answers,
    scores: scoreAssessment(items, answers),
    version: ASSESSMENT_BANK_VERSION,
  };
  if (sub.sessionCode) response.sessionCode = sub.sessionCode;
  return { response, dropped };
}

// ---------------------------------------------------------------------------------------------
// KPIs and the aggregate summary (n >= 5 suppression)

export interface AssessmentMetricInfo {
  id: AssessmentMetricId;
  kpi: AssessmentKpiId;
  label: string;
  min: number;
  max: number;
  /** null when neither direction is "better" (criterion c: 0 is balanced). */
  higherIsBetter: boolean | null;
  format: 'percent' | 'number' | 'scale';
  kinds: readonly AssessmentKind[];
}

const K_ALL = EVERY_KIND;

export const ASSESSMENT_METRICS: readonly AssessmentMetricInfo[] = [
  { id: 'dPrime', kpi: 'risk', label: 'Scam-spotting sensitivity (d′)', min: -4, max: 4, higherIsBetter: true, format: 'number', kinds: K_ALL },
  { id: 'twinAccuracy', kpi: 'risk', label: 'Twin pairs answered correctly', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'criterion', kpi: 'risk', label: 'Response bias (criterion c)', min: -3, max: 3, higherIsBetter: null, format: 'number', kinds: K_ALL },
  { id: 'hitRate', kpi: 'risk', label: 'Scams called scams (hit rate)', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'falseAlarmRate', kpi: 'risk', label: 'Genuine messages called scams (false alarms)', min: 0, max: 1, higherIsBetter: false, format: 'percent', kinds: K_ALL },
  { id: 'twinConfidence', kpi: 'risk', label: 'Confidence on twin pairs (1-3)', min: 1, max: 3, higherIsBetter: null, format: 'scale', kinds: K_ALL },
  { id: 'confidentMiss', kpi: 'risk', label: 'Very sure but wrong', min: 0, max: 1, higherIsBetter: false, format: 'percent', kinds: K_ALL },
  { id: 'flagHitRate', kpi: 'risk', label: 'Warning signs found', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'flagFalseAlarmRate', kpi: 'risk', label: 'Ordinary details flagged', min: 0, max: 1, higherIsBetter: false, format: 'percent', kinds: K_ALL },
  { id: 'decisionAccuracy', kpi: 'decision', label: 'Safest choice on unfamiliar scenarios', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'consequenceAccuracy', kpi: 'consequence', label: 'Likely consequences identified', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'peerConfidence', kpi: 'peer', label: 'Confidence to help a friend (1-5)', min: 1, max: 5, higherIsBetter: true, format: 'scale', kinds: K_ALL },
  { id: 'peerJudgement', kpi: 'peer', label: 'Best thing to say to a friend', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'knowledge', kpi: 'retention', label: 'Knowledge index (all accuracy items)', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
  { id: 'jammedAction', kpi: 'retention', label: 'Jammed Freeze: made a real-world Hold', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: ['return'] },
  { id: 'jammedTell', kpi: 'retention', label: 'Jammed Freeze: chose someone safe to tell', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: ['return'] },
  { id: 'engagement', kpi: 'engagement', label: 'Enjoyment and usability (1-5)', min: 1, max: 5, higherIsBetter: true, format: 'scale', kinds: ['post'] },
  { id: 'playAgain', kpi: 'engagement', label: 'Would play again (yes = 1, maybe = 0.5)', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: ['post'] },
  { id: 'answered', kpi: 'engagement', label: 'Questions answered (not skipped)', min: 0, max: 1, higherIsBetter: true, format: 'percent', kinds: K_ALL },
];

export const ASSESSMENT_KPIS: readonly { id: AssessmentKpiId; number: number; label: string; measure: string }[] = [
  { id: 'risk', number: 1, label: 'Risk recognition', measure: 'Twin pairs with confidence (d′, criterion c, accuracy) and red-flag spotting' },
  { id: 'decision', number: 2, label: 'Decision accuracy on unfamiliar scenarios', measure: 'Held-out vignettes never used in gameplay' },
  { id: 'consequence', number: 3, label: 'Consequence awareness', measure: 'Consequence Timeline items (now, days, weeks, who is affected)' },
  { id: 'peer', number: 4, label: 'Peer-intervention confidence', measure: '3 self-efficacy items plus 1 situational-judgement item' },
  { id: 'retention', number: 5, label: 'Retention', measure: 'Form C at the Return visit compared with post, plus the jammed Freeze' },
  { id: 'engagement', number: 6, label: 'Engagement', measure: 'Post-only enjoyment and usability items, play-again and completion' },
];

/** A reported cell. When fewer than ASSESSMENT_MIN_GROUP people contribute, everything is null and suppressed. */
export interface AssessmentCell {
  n: number | null;
  mean: number | null;
  sd: number | null;
  suppressed: boolean;
}

/** A within-person change (same code at both visits) with a 95% confidence interval. */
export interface AssessmentDelta {
  n: number | null;
  mean: number | null;
  ci95: [number, number] | null;
  suppressed: boolean;
}

export interface AssessmentMetricSummary {
  id: AssessmentMetricId;
  label: string;
  format: AssessmentMetricInfo['format'];
  higherIsBetter: boolean | null;
  pre: AssessmentCell;
  post: AssessmentCell;
  return: AssessmentCell;
  postVsPre: AssessmentDelta;
  returnVsPost: AssessmentDelta;
  returnVsPre: AssessmentDelta;
}

export interface AssessmentKpiSummary {
  id: AssessmentKpiId;
  number: number;
  label: string;
  measure: string;
  metrics: AssessmentMetricSummary[];
}

export interface AssessmentSummary {
  minGroup: number;
  /** Responses per kind (null = fewer than minGroup). */
  responses: Record<AssessmentKind, number | null>;
  /** People with both visits (matched by code). */
  matched: { prePost: number | null; postReturn: number | null; preReturn: number | null };
  bands: Record<BandId, number | null>;
  kpis: AssessmentKpiSummary[];
  /** Post-visit reflection chips; null when the post group is too small. */
  reflections: { id: string; label: string; count: number | null; share: number | null }[] | null;
}

/** Two-sided 95% critical values of Student's t for df 1-30. */
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tCritical95(df: number): number {
  if (df < 1) return Infinity;
  if (df <= 30) return T95[df - 1] ?? 1.96;
  if (df <= 40) return 2.021;
  if (df <= 60) return 2.0;
  if (df <= 120) return 1.98;
  return 1.96;
}

function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function cell(values: readonly number[], minN: number): AssessmentCell {
  if (values.length < minN) return { n: null, mean: null, sd: null, suppressed: true };
  return { n: values.length, mean: round(mean(values), 3), sd: round(sd(values), 3), suppressed: false };
}

function delta(diffs: readonly number[], minN: number): AssessmentDelta {
  if (diffs.length < minN) return { n: null, mean: null, ci95: null, suppressed: true };
  const m = mean(diffs);
  const half = (tCritical95(diffs.length - 1) * sd(diffs)) / Math.sqrt(diffs.length);
  return { n: diffs.length, mean: round(m, 3), ci95: [round(m - half, 3), round(m + half, 3)], suppressed: false };
}

const countOrNull = (n: number, minN: number): number | null => (n >= minN ? n : null);

/**
 * Aggregates responses into per-KPI means and within-person deltas. Every cell with fewer than
 * ASSESSMENT_MIN_GROUP contributors is suppressed (callers cannot lower the threshold).
 * If the same code and kind appear twice, the later one wins.
 */
export function summarise(responses: readonly AssessmentResponse[], options: { minGroup?: number } = {}): AssessmentSummary {
  const minN = Math.max(ASSESSMENT_MIN_GROUP, Math.floor(options.minGroup ?? ASSESSMENT_MIN_GROUP));
  const byKind: Record<AssessmentKind, Map<string, AssessmentResponse>> = { pre: new Map(), post: new Map(), return: new Map() };
  for (const r of responses) if (isAssessmentKind(r.kind)) byKind[r.kind].set(r.code, r);

  const paired = (from: AssessmentKind, to: AssessmentKind): [AssessmentResponse, AssessmentResponse][] =>
    [...byKind[to].values()].flatMap((b) => {
      const a = byKind[from].get(b.code);
      return a ? [[a, b] as [AssessmentResponse, AssessmentResponse]] : [];
    });
  const pairs = { prePost: paired('pre', 'post'), postReturn: paired('post', 'return'), preReturn: paired('pre', 'return') };

  const values = (kind: AssessmentKind, metric: AssessmentMetricId): number[] =>
    [...byKind[kind].values()].map((r) => r.scores[metric]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const diffs = (list: [AssessmentResponse, AssessmentResponse][], metric: AssessmentMetricId): number[] =>
    list.flatMap(([a, b]) => {
      const x = a.scores[metric];
      const y = b.scores[metric];
      return typeof x === 'number' && typeof y === 'number' ? [y - x] : [];
    });

  const kpis: AssessmentKpiSummary[] = ASSESSMENT_KPIS.map((k) => ({
    ...k,
    metrics: ASSESSMENT_METRICS.filter((m) => m.kpi === k.id).map((m) => ({
      id: m.id,
      label: m.label,
      format: m.format,
      higherIsBetter: m.higherIsBetter,
      pre: cell(values('pre', m.id), minN),
      post: cell(values('post', m.id), minN),
      return: cell(values('return', m.id), minN),
      postVsPre: delta(diffs(pairs.prePost, m.id), minN),
      returnVsPost: delta(diffs(pairs.postReturn, m.id), minN),
      returnVsPre: delta(diffs(pairs.preReturn, m.id), minN),
    })),
  }));

  const bands: Record<BandId, number> = { junior: 0, teen: 0, 'young-adult': 0 };
  const people = new Map<string, BandId>();
  for (const kind of ASSESSMENT_KINDS) for (const r of byKind[kind].values()) people.set(r.code, r.band);
  for (const band of people.values()) if (band in bands) bands[band]++;

  const posts = [...byKind.post.values()];
  const reflectItem = SHARED.find((i): i is ChipsItem => i.type === 'chips');
  const reflections =
    posts.length >= minN && reflectItem
      ? reflectItem.chips.map((chip) => {
          const count = posts.filter((r) => {
            const a = r.answers[reflectItem.id];
            return a?.type === 'chips' && a.chips.includes(chip.id);
          }).length;
          return count >= minN
            ? { id: chip.id, label: chip.text, count, share: round(count / posts.length, 3) }
            : { id: chip.id, label: chip.text, count: null, share: null };
        })
      : null;

  return {
    minGroup: minN,
    responses: {
      pre: countOrNull(byKind.pre.size, minN),
      post: countOrNull(byKind.post.size, minN),
      return: countOrNull(byKind.return.size, minN),
    },
    matched: {
      prePost: countOrNull(pairs.prePost.length, minN),
      postReturn: countOrNull(pairs.postReturn.length, minN),
      preReturn: countOrNull(pairs.preReturn.length, minN),
    },
    bands: {
      junior: countOrNull(bands.junior, minN),
      teen: countOrNull(bands.teen, minN),
      'young-adult': countOrNull(bands['young-adult'], minN),
    },
    kpis,
    reflections,
  };
}
