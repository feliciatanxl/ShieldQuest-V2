// Red-Flag Wordsearch: a short fictional scam message, with 5-6 of its warning words hidden in a letter grid.
// Status: draft. Needs educator sign-off like the missions (tone, reading level, accuracy of every "why").
import type { BandId } from '../../framework';
import type { WordsearchGridSpec, WordsearchPuzzle } from './types';

export const WORDSEARCH_GRID: Record<BandId, WordsearchGridSpec> = {
  junior: { size: 8, directions: ['E', 'S'], showWords: true },
  teen: { size: 10, directions: ['E', 'S', 'SE', 'NE'], showWords: false },
  'young-adult': { size: 10, directions: ['E', 'S', 'SE', 'NE', 'W', 'N'], showWords: false },
};

export const WORDSEARCH_PUZZLES: readonly WordsearchPuzzle[] = [
  // ---- Junior (8×8 grid: every word is 8 letters or fewer) ----
  {
    id: 'ws-free-skins',
    bands: ['junior'],
    status: 'draft',
    channel: 'dm',
    from: 'ProGamer_88',
    meta: 'Message request · not on your friends list',
    message:
      "Hey! I'm giving away FREE skins today. Just send me your game login and password so I can add them. Be quick, only 3 left! Keep it a secret from your parents ok?",
    flags: [
      { word: 'FREE', why: 'Free stuff from a stranger is often bait.' },
      { word: 'LOGIN', why: 'No real giveaway needs your login.' },
      { word: 'PASSWORD', why: 'Your password is only for you. Never share it.' },
      { word: 'QUICK', why: 'Rushing you stops you from thinking.' },
      { word: 'SECRET', why: 'Being asked to hide it from adults is a big warning sign.' },
    ],
    lesson: 'Nobody needs your password to give you something. Keep it private and tell an adult about odd messages.',
  },
  {
    id: 'ws-parcel-fee',
    bands: ['junior', 'teen'],
    status: 'draft',
    channel: 'sms',
    from: 'MetroPost',
    meta: 'Unknown number',
    message:
      'MetroPost: Your parcel is on hold. Pay a small fee of S$1.50 now or it goes back. Click the link: metropost-hold.test URGENT',
    flags: [
      { word: 'PAY', why: 'Delivery firms do not ask you to pay through a text message link.' },
      { word: 'FEE', why: 'A tiny fee is a trick to get card details.' },
      { word: 'CLICK', why: 'Links in surprise texts can open fake pages.' },
      { word: 'LINK', why: 'Check parcels in the real app instead of a link.' },
      { word: 'URGENT', why: 'Hurry words are there to make you panic.' },
    ],
    lesson: 'Do not tap links in surprise delivery texts. Check in the real app, with an adult.',
  },
  {
    id: 'ws-friend-code',
    bands: ['junior', 'teen'],
    status: 'draft',
    channel: 'chat',
    from: 'Mei (new account)',
    meta: 'ChatLah',
    message:
      "Hi it's me Mei! This is my new account. Can you send me the code you just got on your phone? Please hurry. Don't tell anyone ok?",
    flags: [
      { word: 'NEW', why: 'A "new account" could be someone pretending to be your friend.' },
      { word: 'SEND', why: 'Being asked to send something private is a warning sign.' },
      { word: 'CODE', why: 'A code sent to you is like a key. Never share it.' },
      { word: 'HURRY', why: 'Rushing you means you do not stop to check.' },
      { word: 'TELL', why: 'Being told not to tell anyone is a big warning sign.' },
    ],
    lesson: 'Never send a code to anyone, even a friend. Check by calling them or asking in person.',
  },
  {
    id: 'ws-lucky-winner',
    bands: ['junior'],
    status: 'draft',
    channel: 'popup',
    from: 'Pop-up on a game site',
    meta: 'prize-spin.test',
    message:
      "Congrats! You are today's winner! Claim a free new phone. Just type your home address and a card number to pay shipping. Offer ends in 5 minutes!",
    flags: [
      { word: 'WINNER', why: 'You cannot win a contest you never entered.' },
      { word: 'FREE', why: 'A free phone for nothing is too good to be true.' },
      { word: 'ADDRESS', why: 'Never give your home address to a pop-up.' },
      { word: 'CARD', why: 'Never type a card number into a prize pop-up.' },
      { word: 'MINUTES', why: 'A countdown is there to rush you.' },
    ],
    lesson: 'Prize pop-ups are tricks. Close them and tell an adult. Never type in your address or a card number.',
  },
  {
    id: 'ws-trade-first',
    bands: ['junior', 'teen'],
    status: 'draft',
    channel: 'dm',
    from: 'TradeKing',
    meta: 'Message request',
    message:
      "I'll trade you my rare dragon pet! But you go first: send your items, then I send mine. Trust me. Let's chat on another app, not in the game. Do it fast before I log off.",
    flags: [
      { word: 'RARE', why: '"Rare" items are bait to make you want them badly.' },
      { word: 'FIRST', why: 'If you go first, you could get nothing back.' },
      { word: 'TRUST', why: 'Real traders use the safe trade screen, not "trust me".' },
      { word: 'APP', why: 'Moving to another app takes you away from the game\'s safety tools.' },
      { word: 'FAST', why: 'Rushing you means no time to check.' },
    ],
    lesson: "Only trade with the game's own trade screen. If someone rushes you, stop and ask an adult.",
  },
  {
    id: 'ws-quiz-details',
    bands: ['junior'],
    status: 'draft',
    channel: 'popup',
    from: 'Fun Quiz',
    meta: 'quiz-of-the-day.test',
    message:
      'Which superhero are you? Type your full name, your school and your birthday to see! Share with five friends to unlock your result.',
    flags: [
      { word: 'NAME', why: 'Your full name helps strangers find you.' },
      { word: 'SCHOOL', why: 'Your school tells a stranger where you are every day.' },
      { word: 'BIRTHDAY', why: 'Birthdays are often used to guess passwords.' },
      { word: 'SHARE', why: 'Spreading it to friends puts them at risk too.' },
      { word: 'UNLOCK', why: 'Locked results push you to do what they ask.' },
    ],
    lesson: 'Fun quizzes do not need your real details. Skip any quiz that asks for your name, school or birthday.',
  },

  // ---- Teen and Young Adult (10×10 grid) ----
  {
    id: 'ws-easy-job',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'sms',
    from: 'Unknown number',
    meta: 'Text message',
    message:
      'Hi! Earn S$300 a day from home, no experience needed. Just let us use your bank account to receive money and transfer it on. 100% legal, many students do it. Reply fast, only 5 slots. Keep it secret ok?',
    flags: [
      { word: 'EARN', why: 'S$300 a day for no real work is too good to be true.' },
      { word: 'RECEIVE', why: 'Taking in money for strangers is how money mules start.' },
      { word: 'TRANSFER', why: 'Moving money on for others can make you part of a crime.' },
      { word: 'LEGAL', why: 'Saying "100% legal" does not make it legal.' },
      { word: 'FAST', why: 'Limited slots are fake pressure.' },
      { word: 'SECRET', why: 'Real jobs do not need to be kept secret.' },
    ],
    lesson: 'A "job" that moves money through your account is money mule work. It is a crime, even if they call it a job.',
  },
  {
    id: 'ws-bank-alert',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'sms',
    from: 'Harbour Bank',
    meta: 'Text message',
    message:
      'Harbour Bank ALERT: unusual login on your account. Your account will be FROZEN today. Verify now at harbour-secure.test and enter the OTP we send you.',
    flags: [
      { word: 'ALERT', why: 'Scary alerts are written to make you panic.' },
      { word: 'FROZEN', why: 'Threats of losing your account push you to act fast.' },
      { word: 'TODAY', why: 'A deadline is pressure, not proof.' },
      { word: 'VERIFY', why: 'Banks do not ask you to "verify" through a text link.' },
      { word: 'OTP', why: 'Never share an OTP, even with someone who says they are the bank.' },
    ],
    lesson: 'Worried about your bank? Open its app yourself or call the number on your card. Never use the link.',
  },
  {
    id: 'ws-gift-cards',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'chat',
    from: 'Alex (met online)',
    meta: 'ChatLah',
    message:
      "Hey, my wallet got stolen overseas. Can you buy gift cards and send me the codes? I'll pay you back double. Please don't tell your family, they won't understand. I need it tonight.",
    flags: [
      { word: 'STOLEN', why: 'Sad stories are used to switch off your doubts.' },
      { word: 'GIFT', why: 'Asking for gift cards is a classic scam. They are hard to trace.' },
      { word: 'CODES', why: 'Card codes are as good as cash. Once sent, they are gone.' },
      { word: 'DOUBLE', why: 'Promises to pay back double are bait.' },
      { word: 'FAMILY', why: 'Cutting you off from family stops anyone warning you.' },
      { word: 'TONIGHT', why: 'A deadline stops you from checking.' },
    ],
    lesson: 'Never send gift card codes to someone you only know online. Talk to someone you trust first.',
  },
  {
    id: 'ws-sim-cash',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'chat',
    from: 'Ray',
    meta: 'ChatLah',
    message:
      "Hey, want easy cash? Just register a SIM card in your name and pass it to me. I give you S$100 each. It's for my company's phones. Don't ask so many questions lah.",
    plainMessage:
      "Hey, want easy cash? Just register a SIM card in your name and pass it to me. I give you S$100 each. It's for my company's phones. Don't ask so many questions.",
    flags: [
      { word: 'EASY', why: '"Easy cash" is how recruiters hook you.' },
      { word: 'CASH', why: 'Paying you for a SIM is a sign it will be misused.' },
      { word: 'SIM', why: 'SIM cards handed to others are often used for scams.' },
      { word: 'NAME', why: 'Anything in your name can be traced back to you.' },
      { word: 'QUESTIONS', why: 'Being told not to ask questions is a warning sign.' },
    ],
    lesson: 'Never register or hand over a SIM card for someone else. It can be a crime, and it traces back to you.',
  },
  {
    id: 'ws-concert-tickets',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'chat',
    from: 'Barang Market seller',
    meta: 'Chat outside the app',
    message:
      'Selling 2 concert tickets, sold out everywhere! Cheap, only S$80 each. Pay first by MetroPay to my personal account. Many people asking, so pay now to reserve. No refund.',
    flags: [
      { word: 'CHEAP', why: 'Prices far below normal are bait.' },
      { word: 'FIRST', why: 'Paying first to a stranger leaves you with no way back.' },
      { word: 'PERSONAL', why: 'Paying a personal account skips the buyer protection.' },
      { word: 'NOW', why: 'Rushing you stops you from checking the seller.' },
      { word: 'RESERVE', why: '"Many people asking" is fake competition.' },
      { word: 'REFUND', why: '"No refund" means no help if it goes wrong.' },
    ],
    lesson: "Buy from the official seller, or use the platform's own checkout. Never pay a stranger's account first.",
  },
  {
    id: 'ws-account-appeal',
    bands: ['teen', 'young-adult'],
    status: 'draft',
    channel: 'email',
    from: 'ChatLah Support',
    meta: 'support@chatlah-appeal.test',
    message:
      'Your account broke our rules and will be DELETED in 24 hours. To appeal, log in at chatlah-appeal.test with your password and the code we text you. Ignore this and you lose everything.',
    flags: [
      { word: 'DELETED', why: 'A scary threat makes you act before you think.' },
      { word: 'APPEAL', why: 'Real appeals happen inside the app, not through an email link.' },
      { word: 'PASSWORD', why: 'No support team needs your password.' },
      { word: 'CODE', why: 'Your login code lets them into your account.' },
      { word: 'LOSE', why: 'Fear of losing everything is the hook.' },
    ],
    lesson: 'Check account warnings inside the real app. Never type your password or code into a link from a message.',
  },
  {
    id: 'ws-vip-profit',
    bands: ['young-adult'],
    status: 'draft',
    channel: 'chat',
    from: 'Jay (uni friend of a friend)',
    meta: 'ChatLah group invite',
    message:
      "Bro, my mentor's trading group made 30% profit in a week. Guaranteed returns, zero risk. Min deposit only S$500. Join the VIP group before it closes tonight. Don't miss out lah!",
    plainMessage:
      "My mentor's trading group made 30% profit in a week. Guaranteed returns, zero risk. Min deposit only S$500. Join the VIP group before it closes tonight. Don't miss out!",
    flags: [
      { word: 'PROFIT', why: '30% in a week is far beyond any real investment.' },
      { word: 'GUARANTEED', why: 'No real investment can promise returns.' },
      { word: 'RISK', why: '"Zero risk" is never true when money is invested.' },
      { word: 'DEPOSIT', why: 'Paying in first is how the money disappears.' },
      { word: 'VIP', why: '"VIP" groups make you feel special so you trust them.' },
      { word: 'CLOSES', why: 'A closing deadline stops you from checking.' },
    ],
    lesson: 'Guaranteed profit with zero risk does not exist. Check any investment with a trusted adult before paying.',
  },
];
