import type { Mission } from '../../mission';

// M09 Easy Money, 14-16 variant "Lend Me Your Account" (GAME_DESIGN.md §9.2): S$30 to receive an e-wallet top-up
// and forward it. Three exits. Consequences in simple words (§5.4 teen dial): the account is restricted, parents are
// told, and a trusted adult helps sort it out. Mule content stops at recognising the request.

export const easyMoneyTeen: Mission = {
  id: 'easy-money-teen',
  version: 1,
  title: 'Lend Me Your Account',
  district: 'digi-district',
  scene: 'void-deck',
  bands: ['teen'],
  theme: 'Money mule recruitment',
  premise: 'A stranger offers Arjun S$30 to receive money in his LumenPay e-wallet and send it on. His friend Ivan says he does it every week.',
  skillFocus: ['S', 'I', 'E'],
  timeOfDay: 'evening',
  scaffold: 'guided',
  resident: 'arjun',
  cast: [
    { id: 'arjun', name: 'Arjun', role: 'resident', anchor: 'bench', pose: 'phone', look: { body: '#38bdf8', accent: '#075985', hair: 'short' } },
    { id: 'ivan', name: 'Ivan', role: 'pressurer', anchor: 'stone-table', pose: 'sit', look: { body: '#fb923c', accent: '#7c2d12', hair: 'cap' } },
    { id: 'ace', name: 'FastTopUp_Ace', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'mum', name: "Arjun's mum", role: 'trusted', anchor: 'lift-lobby', pose: 'walk', look: { body: '#c084fc', accent: '#581c87', hair: 'long' } },
  ],
  intro: 'Block 41 void deck, 7pm. Arjun and Ivan are killing time after CCA. Arjun wants new earbuds but his savings are low. Then his phone buzzes.',
  live: {
    durationSec: 50,
    decisionPrompt: 'Ace is waiting for "OK". What should Arjun do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'A new ChatLah message from someone called FastTopUp_Ace.' },
      { id: 'b2', at: 4, from: 'ace', channel: 'chat', text: 'Hi Arjun! Ivan says you are cool. Want S$30 for 5 mins? Easy one.', tactic: 'too-good', attachment: { kind: 'job', label: 'Top-up helper', detail: '5 mins · S$30 · no experience' } },
      { id: 'b3', at: 9, from: 'ace', channel: 'chat', text: 'I send S$200 to your LumenPay. You keep S$30 and send S$170 to my friend. That is all.' },
      { id: 'b4', at: 15, from: 'ivan', channel: 'speech', text: 'I do it every week. Free money, bro.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 20, from: 'arjun', channel: 'chat', text: "Why can't you just send it to your friend yourself?" },
      { id: 'b6', at: 25, from: 'ace', channel: 'chat', text: 'My account got limit lah. Many people help me, all ok one. See.', tactic: 'fake-proof', attachment: { kind: 'screenshot', label: 'thank_you_msgs.png', detail: 'Ten "thanks bro, got my $30!" messages' } },
      { id: 'b7', at: 31, from: 'ace', channel: 'chat', text: 'Must do in 10 mins ok, my friend is waiting.', tactic: 'urgency' },
      { id: 'b8', at: 37, from: 'ace', channel: 'chat', text: "Don't tell your parents. Adults don't get side hustles.", tactic: 'secrecy' },
      { id: 'b9', at: 42, from: 'ivan', channel: 'speech', text: "Don't be scared lah. I told him you're in already.", tactic: 'loyalty' },
      { id: 'b10', at: 47, from: 'ace', channel: 'chat', text: 'Sending now. Reply OK.', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-reward', label: 'S$30 for five minutes', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Nobody pays S$30 for five minutes of nothing. The pay is bait.' },
    { id: 'c-account', label: "Money goes in and straight out of Arjun's e-wallet", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: "The \"job\" is Arjun's account. Money that has to pass through a stranger's helper usually comes from people who were scammed." },
    { id: 'c-proof', label: 'Screenshots of "happy helpers" sent by Ace', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'fake-proof', explain: 'Screenshots from the person asking are easy to fake. Proof you cannot check is not proof.' },
    { id: 'c-deadline', label: '"Must do in 10 mins"', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, tactic: 'urgency', explain: 'The rush is there so Arjun does not stop and ask anyone.' },
    { id: 'c-secret', label: '"Don\'t tell your parents"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'secrecy', explain: 'When someone says not to tell your parents, that is the moment to tell them.' },
    { id: 'c-referral', label: 'Ivan\'s phone: "Bring a friend +S$10"', target: { kind: 'anchor', anchor: 'stone-table' }, redFlag: true, explain: 'Ivan is paid for each friend he brings in. He is being used to recruit others too.' },
    { id: 'c-question', label: 'Arjun asks why Ace needs him', target: { kind: 'beat', beatId: 'b5' }, redFlag: false, explain: 'Asking "why me?" is a smart question, not a warning sign. Notice that Ace never really answers it.' },
    { id: 'c-ad', label: 'A LumenPay ad by the lift: "Send money to friends in a tap"', target: { kind: 'anchor', anchor: 'lift-lobby' }, redFlag: false, explain: 'E-wallets are normal and useful. The problem is not LumenPay. It is a stranger wanting to use your account.' },
  ],
  influence: {
    from: 'ivan',
    hidden: { label: "Ace's recruiting chain", description: 'Ace pays teens to bring in friends whose e-wallets can be used to move money from scam victims.' },
    question: 'Pull the thread from Ivan. What does Ivan get if Arjun says yes?',
    options: [
      { id: 'i-help', text: 'Nothing. He just wants Arjun to have money for earbuds.', correct: false, explain: 'Ivan may think so, but the thread shows he is paid to bring friends in.' },
      { id: 'i-bonus', text: 'S$10 for every friend he brings in.', correct: true, explain: "Right. Ivan's phone shows +S$10 per friend. He is being used too, to pull in the people he knows." },
      { id: 'i-cut', text: "Some of Arjun's S$30.", correct: false, explain: 'Close, but it is a separate bonus from Ace. Either way, the money comes from the same scheme.' },
    ],
  },
  forecast: {
    question: 'If Arjun says OK, what is most likely to happen in the next few weeks?',
    horizon: 'next-month',
    options: [
      { id: 'f-keep', text: 'Arjun keeps the S$30 and buys his earbuds.', likely: false },
      { id: 'f-restricted', text: "Arjun's LumenPay gets restricted, and his parents find out why.", likely: true },
      { id: 'f-more', text: 'Ace pays Arjun more next time.', likely: false },
    ],
    explain: 'Money that moves through a borrowed account is traced back. The account gets restricted while police look into it.',
  },
  choices: [
    {
      id: 'accept',
      label: 'Say OK and send the money on',
      safety: 'risky',
      outcome: {
        title: '+S$30',
        text: 'S$200 lands. Arjun sends S$170 on and keeps S$30. Ace sends a 👍 and Ivan fist-bumps him. Earbuds, sorted.',
        mood: 'shiny',
        effects: { wallet: 30 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to say no to anyone who wants to send money through your account, and to tell a trusted adult',
        ifItHappened: "stop, don't move any more money, and tell a parent. Together, contact LumenPay and the police. Coming forward early really helps.",
      },
      aftershock: {
        id: 'wallet-restricted',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '2 WEEKS LATER',
        title: "Arjun's LumenPay is restricted",
        text: "Arjun can't use LumenPay any more. The S$200 came from people who were scammed, and police are looking into the accounts it passed through. His parents have been told. Ace has gone quiet.",
        effects: { wallet: -30, trust: -2, risk: 2 },
        fact: {
          text: 'In a February 2026 police operation, people as young as 14 were investigated as suspected scammers or money mules. Police have said they do not intend to charge people who were genuinely tricked, so telling the truth early matters.',
          source: 'SPF islandwide operation (13 Feb 2026); MHA written reply (15 Oct 2025)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Arjun is scared. What should he do now?',
          options: [
            { id: 'r-tell', text: 'Tell his mum everything, then contact LumenPay and the police together.', good: true, response: 'That is the bravest and best move. His mum helps him explain what happened, and coming forward shows he was tricked. Beacon lights up.', help: ['trusted-adult', 'bank', 'police-hotline'] },
            { id: 'r-delete', text: 'Delete the chats and say nothing.', good: false, response: 'Hiding feels safer, but the chats show Arjun was tricked. It is not too late. Telling his mum is still the next step.' },
            { id: 'r-ace', text: 'Ask Ace to fix it.', good: false, response: 'Ace caused this and gains from Arjun staying quiet. The people who can help are his family, LumenPay and the police.' },
          ],
        },
      },
    },
    {
      id: 'ask-proof',
      label: 'Ask Ace for more proof first',
      safety: 'unsure',
      outcome: {
        title: 'More "proof"',
        text: 'Ace sends a "company card" and more thank-you screenshots. It looks real. But every picture comes from Ace, and none of it explains why he needs Arjun\'s account.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to stop and ask a trusted adult, not the stranger, whether it is OK',
        ifItHappened: 'stop replying, keep the messages, and show them to a parent or teacher. You can also call the ScamShield Helpline 1799 to check.',
      },
    },
    {
      id: 'refuse-tell',
      label: 'Say no, block Ace, and tell Mum',
      safety: 'safe',
      outcome: {
        title: 'Arjun walks away',
        text: 'Arjun types "No thanks", blocks Ace and keeps a screenshot. His mum walks in from the lift. He shows her, and she says he did the right thing. Ivan shrugs, but he looks at his own phone for a long time.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to refuse, keep the messages, and tell a trusted adult',
        ifItHappened: "don't touch any money that a stranger sends you. Tell a parent and contact LumenPay together.",
      },
      aftershock: {
        id: 'afterglow-class',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: the warning spreads',
        text: 'Arjun posts in the class chat: "If someone pays you to use your e-wallet, it\'s a mule job. Don\'t." Two classmates who got the same message from Ace block him.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-tell', text: "A stranger who wants to use your account isn't giving you a job. He wants your account." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-tell', text: 'All the proof is screenshots from Ace. And Ivan gets paid if Arjun joins.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'ask-proof', text: "Ivan is Arjun's friend, and Arjun really wants those earbuds. Asking a few more questions first feels fair." },
  ],
  peerShield: {
    friend: 'ivan',
    timeLabel: '11PM, THREE WEEKS LATER',
    setup: "Late at night, Ivan messages Arjun. His LumenPay is locked, and Ace says he has to bring in two more friends. Ivan is lying on his bed, phone in hand. He's worried.",
    messages: [
      { from: 'ivan', text: 'bro my LumenPay kena locked' },
      { from: 'ivan', text: 'Ace says bring 2 more friends and he will unlock it' },
      { from: 'ivan', text: "don't tell anyone ok" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-thanks', text: "Thanks for telling me. I'm here.", quality: 'great', why: 'Thanking him lowers his guard, so he keeps talking.', guard: -20, doubt: 5 },
        { id: 'o-ok', text: "Hmm. OK, let's think.", quality: 'ok', why: 'Calm, but he does not feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-told', text: 'Told you it was dodgy.', quality: 'harmful', why: 'Blame makes him defensive and more likely to hide the problem.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-used', text: "Ace used you. That's on him. Ace can't unlock anything. Only LumenPay can.", quality: 'great', why: 'Blames the scheme, not Ivan, and shows why Ace is the wrong person to ask.', guard: -5, doubt: 25 },
        { id: 'r-weird', text: 'That sounds weird.', quality: 'ok', why: 'True, but vague. He needs a clear reason.', guard: 0, doubt: 10 },
        { id: 'r-two', text: 'Just bring 2 people, then stop.', quality: 'harmful', why: 'This pulls more friends into the same risk.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-with', text: "I'll be with you when you tell your parents tomorrow.", quality: 'great', why: 'A clear offer of company makes the hard step easier.', guard: -10, doubt: 15 },
        { id: 'f-maybe', text: 'Maybe tell someone?', quality: 'ok', why: 'Kind, but it leaves him to do it alone.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Don't worry, I won't tell anyone.", quality: 'harmful', why: 'A secret is exactly what Ace needs.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-parents', text: 'Tell your parents, then contact LumenPay through the app. We can call ScamShield 1799 first if you want.', quality: 'great', why: 'Points to a trusted adult and official channels.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Search online what to do?', quality: 'ok', why: 'Searching can lead to more fake "helpers". Official channels are safer.', guard: 0, doubt: 0 },
        { id: 'c-ace', text: 'Message Ace and beg him to unlock it.', quality: 'harmful', why: 'Ace gains from Ivan staying in. He cannot unlock a LumenPay account.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Ivan: "ok... can you come over tomorrow when I tell my mum? thanks for not scolding me." He stops asking friends to join.',
      partial: 'Ivan: "ok, I\'ll think about it." He has not decided. Checking in tomorrow could help.',
      fail: 'Ivan: "forget it, I\'ll handle it." Seen.',
    },
  },
  ifThen: {
    if: 'someone offers me money to use my bank account or e-wallet',
    then: 'say no, keep the messages, and tell a parent or call 1799 to check',
  },
  help: ['trusted-adult', 'scamshield-1799', 'bank', 'police-hotline', 'mindline-1771'],
  sources: [
    { label: 'CDSA and CMA amendments: money mule offences, in force 8 Feb 2024', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Islandwide operation: 231 suspected scammers and money mules aged 14-84 investigated (13 Feb 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Written reply on people deceived into providing accounts (15 Oct 2025)', publisher: 'Ministry of Home Affairs', asOf: '2026-10-08' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
