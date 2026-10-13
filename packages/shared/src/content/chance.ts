// Signal Check / Pop Quiz questions for City Board chance tiles. One quick question, an answer and a
// one-sentence "why". Fictional Singapore setting: in-world brands only (MetroPay, MetroPost, Harbour Bank,
// ChatLah), .test web addresses, no real phone numbers or links. Advice is prevention-first and never blames
// the person who was targeted.

import type { BandId } from '../framework';

export interface ChanceOption {
  id: string;
  text: string;
}

export interface ChanceQuestion {
  id: string;
  /** Age bands the question suits. */
  bands: BandId[];
  /** 'scam-or-safe' uses the two fixed options below; 'choice' has 2-4 options of its own. */
  kind: 'scam-or-safe' | 'choice';
  prompt: string;
  options: ChanceOption[];
  /** Id of the correct option. */
  answer: string;
  /** One sentence (25 words or fewer) shown after answering. */
  why: string;
}

export const SCAM_OR_SAFE_OPTIONS: readonly ChanceOption[] = [
  { id: 'scam', text: 'Scam or risky' },
  { id: 'safe', text: 'Looks safe' },
];

const ALL: BandId[] = ['junior', 'teen', 'young-adult'];
const JUNIOR_TEEN: BandId[] = ['junior', 'teen'];
const OLDER: BandId[] = ['teen', 'young-adult'];
const JUNIOR: BandId[] = ['junior'];
const YOUNG_ADULT: BandId[] = ['young-adult'];

const scamOrSafe = (id: string, bands: BandId[], prompt: string, answer: 'scam' | 'safe', why: string): ChanceQuestion => ({
  id,
  bands,
  kind: 'scam-or-safe',
  prompt,
  options: [...SCAM_OR_SAFE_OPTIONS],
  answer,
  why,
});

const choice = (id: string, bands: BandId[], prompt: string, options: [string, string][], answer: string, why: string): ChanceQuestion => ({
  id,
  bands,
  kind: 'choice',
  prompt,
  options: options.map(([oid, text]) => ({ id: oid, text })),
  answer,
  why,
});

export const CHANCE_QUESTIONS: readonly ChanceQuestion[] = [
  // ---- Everyone -----------------------------------------------------------------------------
  scamOrSafe(
    'otp-friend',
    ALL,
    'A friend messages on ChatLah: "I sent my OTP to your phone by mistake. Can you forward it to me?"',
    'scam',
    'An OTP is a key to your account. Never share one, even with friends: their account may have been taken over.',
  ),
  scamOrSafe(
    'parcel-fee',
    ALL,
    'SMS: "MetroPost: your parcel is on hold. Pay $1.50 now at metropost-redeliver.test"',
    'scam',
    'Small "redelivery fees" through a link are a classic trick. Check tracking in the official MetroPost app you open yourself.',
  ),
  scamOrSafe(
    'app-check',
    ALL,
    'You get an alert about your MetroPay account. You close the message, open the MetroPay app yourself and check there.',
    'safe',
    'Opening the official app yourself skips any fake link. That is exactly the right way to check.',
  ),
  scamOrSafe(
    'free-skins',
    ALL,
    'A website promises free rare skins if you log in with your game account details.',
    'scam',
    'Free-skin sites collect logins to steal accounts. Real rewards come inside the official game, and nobody needs your password.',
  ),
  choice(
    'otp-who',
    ALL,
    'Who should you share a one-time password (OTP) with?',
    [
      ['friend', 'Your best friend'],
      ['bank', 'Someone who says they are from the bank'],
      ['nobody', 'No one at all'],
      ['group', 'Your class group chat'],
    ],
    'nobody',
    'An OTP is only for you to type into the app you opened. Real banks and staff never ask for it.',
  ),
  choice(
    'uniform-selfie',
    ALL,
    'Someone you only know online asks for a selfie in your school uniform. Best move?',
    [
      ['send', 'Send it, they seem nice'],
      ['stop', 'Stop replying, keep the chat and tell a trusted adult'],
      ['blurry', 'Send a blurry one instead'],
    ],
    'stop',
    'Photos that show your school can reveal where you are. Stop, keep the chat and tell a trusted adult. It is not your fault.',
  ),
  scamOrSafe(
    'lucky-draw',
    ALL,
    '"Congrats! You won a phone in the Metro lucky draw! Pay a $20 delivery fee at metro-luckydraw.test"',
    'scam',
    'You cannot win a draw you never joined. Paying a fee to collect a prize is a common scam sign.',
  ),
  choice(
    'rush',
    ALL,
    'A message says: "Reply in 10 minutes or your account will be deleted!" Why the rush?',
    [
      ['help', 'To help you keep your account'],
      ['pressure', 'To stop you from pausing and checking'],
      ['rule', 'It is a normal account rule'],
    ],
    'pressure',
    'Time pressure makes people act before they check. Real services give you time, so pause and verify first.',
  ),
  choice(
    'cousin-new-number',
    ALL,
    'Your "cousin" texts from a new number asking for money urgently. What should you do first?',
    [
      ['send', 'Send the money quickly'],
      ['ask', 'Ask a question only your cousin would know, in the same chat'],
      ['call', 'Call your cousin on the number you already have'],
    ],
    'call',
    'Check through a channel you already trust. Whoever holds the new number can answer anything in that same chat.',
  ),
  scamOrSafe(
    'password-friend',
    ALL,
    'A classmate asks for your game password so they can "level up your character for you".',
    'scam',
    'Even friends should not have your password. Shared logins get changed, sold or lost. Keep it to yourself.',
  ),
  choice(
    'clicked-link',
    ALL,
    'You clicked a strange link and typed your password. What now?',
    [
      ['hide', 'Keep quiet so nobody finds out'],
      ['act', 'Change your password, turn on 2FA and tell a trusted adult'],
      ['wait', 'Wait and see if anything happens'],
    ],
    'act',
    'Acting fast limits the damage. Scams are built to fool smart people, so telling someone is the brave move.',
  ),
  scamOrSafe(
    'qr-poster',
    ALL,
    'A void deck poster says "Scan for free bubble tea!" The QR code asks for your MetroPay login.',
    'scam',
    'A freebie never needs your payment login. Fake QR codes can lead to look-alike login pages.',
  ),
  scamOrSafe(
    'teacher-survey',
    ALL,
    'Your teacher tells the class, in person, about a survey on the school portal you already use.',
    'safe',
    'A person you know, telling you face to face about an official channel you already use, is a trustworthy source.',
  ),
  choice(
    'secret',
    ALL,
    'Which is the biggest red flag in a message?',
    [
      ['greeting', 'It starts with a friendly hello'],
      ['emoji', 'It uses lots of emoji'],
      ['secret', 'It asks you to keep it a secret'],
    ],
    'secret',
    'Secrecy cuts you off from people who could help. Safe adults and real companies do not need you to hide things.',
  ),
  choice(
    'kind-words',
    ALL,
    'A friend lost money to a scam and says they feel stupid. What is a kind thing to say?',
    [
      ['blame', '"You should have known better."'],
      ['support', '"It happens to lots of people. Let\'s tell someone who can help."'],
      ['quiet', '"Don\'t tell anyone, it\'s embarrassing."'],
    ],
    'support',
    'Scams are designed to fool people. Support, not blame, helps them report quickly and get help.',
  ),
  scamOrSafe(
    'protected-checkout',
    ALL,
    'Before buying online, you read the seller\'s reviews and pay through the marketplace\'s protected checkout.',
    'safe',
    'Reviews plus the platform\'s own protected payment give you a way to get help if the item never arrives.',
  ),
  choice(
    'two-fa',
    ALL,
    'Which makes your accounts much harder to take over?',
    [
      ['same', 'Using the same password everywhere'],
      ['2fa', 'Turning on two-factor authentication (2FA)'],
      ['birthday', 'Using your birthday as a password'],
    ],
    '2fa',
    '2FA adds a second check, so a stolen password alone is not enough. Turn it on for important accounts.',
  ),

  // ---- Juniors and teens --------------------------------------------------------------------
  scamOrSafe(
    'gem-gift',
    JUNIOR_TEEN,
    'Someone in a game chat says: "I\'ll gift you 1,000 gems. Just tell me your login first."',
    'scam',
    'Real gifts never need your login. Giving it away lets someone take your account and everything in it.',
  ),
  choice(
    'mean-messages',
    JUNIOR_TEEN,
    'Someone keeps sending you mean messages. Best first step?',
    [
      ['reply', 'Send mean messages back'],
      ['report', 'Screenshot, block, and tell a trusted adult'],
      ['delete', 'Delete your account forever'],
    ],
    'report',
    'Saving proof, blocking and telling an adult helps stop bullying. Being targeted is never your fault.',
  ),
  choice(
    'dare-video',
    JUNIOR_TEEN,
    'Friends dare you to take a snack from a shop without paying, "just for a video". Best move?',
    [
      ['do', 'Do it, it is only small'],
      ['no', 'Say no, suggest something else, and walk away'],
      ['film', 'Film them doing it instead'],
    ],
    'no',
    'Taking things without paying is a crime whatever the size, and videos spread. Saying no and leaving is the strong move.',
  ),

  // ---- Juniors ------------------------------------------------------------------------------
  scamOrSafe(
    'meet-alone',
    JUNIOR,
    'An online gaming friend you have never met asks you to meet them alone after school.',
    'scam',
    'Never meet an online-only friend alone. Tell a parent or trusted adult first; they can help decide what is safe.',
  ),
  scamOrSafe(
    'virus-popup',
    JUNIOR,
    'A pop-up flashes: "Your phone has a virus! Tap here to clean it now!"',
    'scam',
    'Scary pop-ups want you to tap fast. Close it and show a trusted adult. Real phone warnings do not look like ads.',
  ),
  scamOrSafe(
    'card-for-coins',
    JUNIOR,
    'A video says: "Type in your parent\'s card number to unlock free coins!"',
    'scam',
    'Free things never need a card number. Always ask a parent first before typing in any payment details.',
  ),
  choice(
    'who-to-tell',
    JUNIOR,
    'Something online makes you feel worried or uncomfortable. Who can you tell?',
    [
      ['nobody', 'Nobody, just ignore it'],
      ['adult', 'A parent, teacher or another trusted adult'],
      ['stranger', 'The person who sent it'],
    ],
    'adult',
    'A trusted adult can help you decide what to do. You will not be in trouble for asking.',
  ),

  // ---- Teens and young adults ---------------------------------------------------------------
  scamOrSafe(
    'lend-account',
    OLDER,
    'A stranger offers you $300 to "borrow" your bank account to receive a few payments.',
    'scam',
    'That is money muling. Letting others move money through your account is a crime, even if you keep none. Say no.',
  ),
  scamOrSafe(
    'sell-sim',
    OLDER,
    'Someone at the mall offers $50 if you register a SIM card in your name and hand it over.',
    'scam',
    'SIM cards in your name can be used for scams, and you may be held responsible. Never sell or lend them.',
  ),
  scamOrSafe(
    'like-job',
    OLDER,
    'Job ad: "Earn $800 a day just liking videos! Pay a $50 starter fee first."',
    'scam',
    'Real jobs pay you, not the other way round. Big pay for easy tasks plus an upfront fee means scam.',
  ),
  scamOrSafe(
    'cheap-tickets',
    OLDER,
    'A seller offers concert tickets cheaply but only accepts a bank transfer, with no meet-up, "because lots of people want them".',
    'scam',
    'A too-good price, pressure and transfer-only payment are red flags. Use the platform\'s protected checkout, or walk away.',
  ),
  scamOrSafe(
    'safe-account',
    OLDER,
    'A caller says they are from the police and you must move your savings into a "safe account".',
    'scam',
    'Real police never ask you to transfer money to keep it safe. Hang up and call an official number you look up yourself.',
  ),
  choice(
    'bank-call',
    OLDER,
    'You get a call from "Harbour Bank" about a strange payment on your card. Best move?',
    [
      ['details', 'Give your card details so they can block it'],
      ['press', 'Press 1 to speak to an agent'],
      ['hangup', 'Hang up and call the number on your card or in the official app'],
    ],
    'hangup',
    'Caller ID can be faked. End the call and contact the bank through a number you find yourself.',
  ),
  scamOrSafe(
    'crypto-friend',
    OLDER,
    'A new online friend shows big crypto profits and offers to teach you on a special trading app.',
    'scam',
    'Investment scams often start with friendly chats and fake profit screenshots. Money sent to these apps is rarely recovered.',
  ),
  scamOrSafe(
    'parcel-job',
    OLDER,
    'A "part-time job" asks you to collect parcels from strangers and pass them on, no questions asked.',
    'scam',
    'Unknown parcels can hold illegal or stolen goods. A job that says "no questions asked" is a big red flag.',
  ),

  // ---- Young adults -------------------------------------------------------------------------
  scamOrSafe(
    'phishing-email',
    YOUNG_ADULT,
    'An email from "MetroPay Security" says to log in at metropay-secure.test within 24 hours or lose access.',
    'scam',
    'Look-alike addresses and deadlines are phishing signs. Open the official MetroPay app yourself to check your account.',
  ),
  scamOrSafe(
    'screen-share',
    YOUNG_ADULT,
    'A "tech support" caller asks you to install a screen-sharing app so they can fix your banking app.',
    'scam',
    'Screen sharing lets them see your OTPs and passwords. Real support never asks for this. Hang up.',
  ),
  scamOrSafe(
    'pay-friend',
    YOUNG_ADULT,
    'You are paying a friend back. You confirm their number with them in person, then send it in the MetroPay app.',
    'safe',
    'Checking details with the person directly, then paying in the official app, is a safe way to send money.',
  ),
  scamOrSafe(
    'id-loan',
    YOUNG_ADULT,
    'An SMS offers a fast loan with "no checks". You only need to send a photo of your ID card.',
    'scam',
    'Unlicensed lenders and scammers misuse ID photos. Never send pictures of your ID to strangers or unknown lenders.',
  ),
];

export const chanceById = (id: string): ChanceQuestion | undefined => CHANCE_QUESTIONS.find((q) => q.id === id);

/** Questions for a band (all of them when the band is not set yet). */
export function chanceFor(band: BandId | null): ChanceQuestion[] {
  return CHANCE_QUESTIONS.filter((q) => !band || q.bands.includes(band));
}

/** Picks a question for the band, avoiding recently seen ids while any unseen ones remain. */
export function pickChance(band: BandId | null, rng: () => number = Math.random, avoid: readonly string[] = []): ChanceQuestion {
  const pool = chanceFor(band);
  const fresh = pool.filter((q) => !avoid.includes(q.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(rng() * from.length) % from.length]!;
}

/**
 * Picks `count` different questions for a band (Squad Dash rounds), shuffled with `rng` so a seeded rng gives
 * the same set every time. Questions of the preferred `kinds` come first; other kinds only fill the gap when a
 * band has too few. Ids in `avoid` are used only once every fresh question has been dealt.
 */
export function pickChanceSet(
  band: BandId | null,
  count: number,
  rng: () => number = Math.random,
  opts: { kinds?: readonly ChanceQuestion['kind'][]; avoid?: readonly string[] } = {},
): ChanceQuestion[] {
  const n = Math.max(0, Math.floor(count));
  const avoid = new Set(opts.avoid ?? []);
  const kinds = opts.kinds;
  const shuffle = (list: ChanceQuestion[]): ChanceQuestion[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)) % (i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  const pool = chanceFor(band);
  const preferred = (q: ChanceQuestion) => !kinds || kinds.includes(q.kind);
  // Fresh preferred, fresh other kinds, then the avoided ones (preferred first) as a last resort.
  const tiers = [
    pool.filter((q) => !avoid.has(q.id) && preferred(q)),
    pool.filter((q) => !avoid.has(q.id) && !preferred(q)),
    pool.filter((q) => avoid.has(q.id) && preferred(q)),
    pool.filter((q) => avoid.has(q.id) && !preferred(q)),
  ];
  const out: ChanceQuestion[] = [];
  for (const tier of tiers) {
    if (out.length >= n) break;
    out.push(...shuffle(tier).slice(0, n - out.length));
  }
  return out;
}
