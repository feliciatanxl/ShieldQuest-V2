import type { Mission } from '../../mission';

// Reference mission — the model every other mission follows.
// M09 Easy Money, the flagship (GAME_DESIGN.md §9.2; proposal sample mission "The 'Easy Money' Encounter").
// 17-24 band: money pressure is real (cut shifts, rent due), evidence is more ambiguous, and there is a fourth
// "stall" exit. The 14-16 variant "Lend Me Your Account" lives in easy-money-teen.ts. The Peer Shield folds in
// PS1 "The 2am Message" (§9.3). Mule content stops at recognising the request; it never explains the laundering.
// The GDD's lookalike-logo red herring lives inside the hotline clue so the mission keeps two decoys; the engine
// tests pin the ids c-question and c-poster as decoys and i-bonus, f-restricted, r-tell and the shield tiles as-is.

export const easyMoney: Mission = {
  id: 'easy-money',
  version: 3,
  title: 'Easy Money',
  district: 'digi-district',
  scene: 'void-deck',
  bands: ['young-adult'],
  theme: 'Money mule recruitment',
  premise:
    'Ren\'s shifts were cut and his rent share is due Friday. A "side hustle" pays S$200 for ten minutes. All he has to do is lend his bank account.',
  skillFocus: ['S', 'H', 'I', 'E', 'L', 'D'],
  timeOfDay: 'evening',
  scaffold: 'guided',
  resident: 'ren',
  cast: [
    { id: 'ren', name: 'Ren', role: 'resident', anchor: 'bench', pose: 'phone', look: { body: '#60a5fa', accent: '#1e3a8a', hair: 'short' } },
    { id: 'dev', name: 'Dev', role: 'pressurer', anchor: 'stone-table', pose: 'sit', look: { body: '#f97316', accent: '#7c2d12', hair: 'cap' } },
    { id: 'mel', name: 'Mel | QuikGig Partners', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'auntie', name: 'Auntie May', role: 'trusted', anchor: 'letterboxes', pose: 'stand', look: { body: '#a3e635', accent: '#365314', hair: 'bun' } },
  ],
  intro:
    "Block 23 void deck, 6.40pm. Ren, 19, just had his café shifts cut, and his share of the rent is due Friday. He's sitting with his friend Dev when a message comes in.",
  live: {
    durationSec: 60,
    decisionPrompt: 'Ren\'s thumb is over "OK". What should Ren do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Ren\'s phone buzzes. A new ChatLah message from "Mel | QuikGig Partners", with a smart blue logo.' },
      { id: 'b2', at: 4, from: 'mel', channel: 'chat', text: "Hi Ren! Dev says you're looking for extra income. Quick admin job, you keep S$200 😊", tactic: 'too-good', attachment: { kind: 'job', label: 'Payment Assistant (part-time)', detail: '10 mins · S$200 · no experience needed' } },
      { id: 'b3', at: 9, from: 'mel', channel: 'chat', text: "All you do: receive a transfer into your Harbour Bank account, then send it on to our partner. That's it." },
      { id: 'b4', at: 15, from: 'dev', channel: 'speech', text: 'I did it last week. Just try once lah, everyone does side hustles now.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 20, from: 'ren', channel: 'chat', text: "What's the company name? Is this legit?" },
      { id: 'b6', at: 25, from: 'mel', channel: 'chat', text: "QuikGig Partners. 100% legal, urgent, risk-free. We're licensed, see our cert.", tactic: 'fake-proof', attachment: { kind: 'screenshot', label: 'company_licence.png', detail: 'A certificate image with a gold seal' } },
      { id: 'b7', at: 31, from: 'mel', channel: 'chat', text: 'Any doubts, call our compliance hotline 8XXX XXXX 👍', tactic: 'authority', attachment: { kind: 'image', label: 'compliance_desk.png', detail: 'A blue shield logo that looks a lot like Harbour Bank\'s, above the hotline number' } },
      { id: 'b8', at: 36, from: 'mel', channel: 'chat', text: 'Need your answer in 10 mins or the slot goes to someone else.', tactic: 'urgency' },
      { id: 'b9', at: 41, from: 'mel', channel: 'chat', text: "Don't mention it to your bank ok. They don't understand this kind of business.", tactic: 'secrecy' },
      { id: 'b10', at: 47, from: 'dev', channel: 'speech', text: "Come on bro, I already told Mel you're in. Don't make me look bad.", tactic: 'loyalty' },
      { id: 'b11', at: 54, from: 'mel', channel: 'chat', text: 'Last 2 slots today. Reply OK to start.', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-reward', label: 'S$200 for ten minutes of "work"', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Real part-time jobs do not pay this much for so little. The pay is bait.' },
    { id: 'c-account', label: "The \"job\" runs through Ren's own bank account", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: 'If a job only needs your bank account, your account is what they are really after. Money moved this way usually comes from scam victims.' },
    { id: 'c-proof', label: '"100% legal" plus a licence picture sent by Mel', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'fake-proof', explain: 'Anyone can type "100% legal" or make a certificate image. Proof from the person asking is not proof. Check through a source you find yourself.' },
    { id: 'c-hotline', label: 'A "compliance hotline" next to a Harbour Bank lookalike logo', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, tactic: 'authority', explain: 'A number inside the message leads back to the same people, and logos are easy to copy. Real checks go through contacts you look up yourself, like your bank\'s number on your card.' },
    { id: 'c-deadline', label: '10-minute deadline', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'urgency', explain: 'A deadline stops Ren from checking or asking anyone. Real opportunities can wait.' },
    { id: 'c-secret', label: '"Don\'t mention it to your bank"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'secrecy', explain: 'Secrecy keeps away the people most likely to spot the problem. A real job never needs to hide from your bank.' },
    { id: 'c-referral', label: 'Dev\'s phone: "Referral bonus +S$50", and a bank alert on his lock screen', target: { kind: 'anchor', anchor: 'stone-table' }, redFlag: true, explain: 'Dev earns money for every friend he brings in, so he is being used to recruit others too. His lock screen also says "Account temporarily restricted": the scheme is already catching up with him.' },
    { id: 'c-joined', label: 'Up close on Ren\'s screen: Mel\'s profile says "Joined 3 days ago"', target: { kind: 'anchor', anchor: 'bench' }, redFlag: true, explain: 'A "licensed payments company" whose account is three days old. New profiles are cheap to make and easy to throw away.' },
    { id: 'c-question', label: 'Ren asks for the company name', target: { kind: 'beat', beatId: 'b5' }, redFlag: false, explain: 'Asking questions is a good instinct, not a warning sign. But notice that every answer comes from Mel, so none of it is independent.' },
    { id: 'c-poster', label: 'Community poster: "Not sure? Check first."', target: { kind: 'anchor', anchor: 'notice-board' }, redFlag: false, explain: 'This is not a red flag. It is a resource: a reminder that you can call the ScamShield Helpline 1799 to check.' },
  ],
  influence: {
    from: 'dev',
    hidden: { label: "Mel's recruiting network", description: 'Mel pays people to bring in friends whose bank accounts can be used to move money taken from scam victims.' },
    question: 'Pull the thread from Dev. What does Dev get if Ren says yes?',
    options: [
      { id: 'i-help', text: 'Nothing. He just wants Ren to make rent.', correct: false, explain: 'Dev may believe that, but the thread shows he is being paid to recruit.' },
      { id: 'i-bonus', text: 'A referral bonus for every friend he brings in.', correct: true, explain: "Right. Dev's phone shows +S$50 per referral. He is being used too: recruiters pay people to pull in their friends." },
      { id: 'i-share', text: "Half of Ren's S$200.", correct: false, explain: "Close, but it's a separate bonus from Mel. Either way, the money comes from the same scheme." },
    ],
  },
  forecast: {
    question: 'If Ren goes ahead, what is most likely to happen by next month?',
    horizon: 'next-month',
    options: [
      { id: 'f-keep', text: 'Ren keeps the S$200 and nothing else happens.', likely: false },
      { id: 'f-restricted', text: "Harbour Bank restricts Ren's account while police look into where the money came from.", likely: true },
      { id: 'f-job', text: 'Mel offers Ren a full-time job.', likely: false },
    ],
    explain: 'Money passing through a mule account usually comes from scam victims. Banks and police trace it back through every account it touched.',
  },
  choices: [
    {
      id: 'accept',
      label: 'Say OK and do the transfer',
      safety: 'risky',
      outcome: {
        title: '+S$200',
        text: 'The money lands, Ren sends it on, and S$200 stays with him. Mel sends a thumbs-up and Dev grins. Rent is sorted. It felt easy.',
        mood: 'shiny',
        effects: { wallet: 200 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to say no to any job that moves money through your own account, and to check with the ScamShield Helpline 1799 if unsure',
        ifItHappened: 'stop all transfers, tell a trusted adult, call your bank on its official number and make a police report. Coming forward early matters.',
      },
      aftershock: {
        id: 'account-restricted',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '3 WEEKS LATER',
        title: "Harbour Bank restricts Ren's account",
        text: 'A Harbour Bank notice: "Account services restricted while we review incoming funds reported as linked to a scam." The S$200 is reversed. Then a letter: police would like to speak with Ren about transfers through his account. Letting others move money through your account is how scams hide stolen money. It can lead to restrictions and an investigation, even if you didn\'t know where the money came from, if you ignored warning signs.',
        effects: { wallet: -200, trust: -2, risk: 2 },
        fact: {
          text: 'Since 8 Feb 2024, moving money for others despite warning signs can be an offence in Singapore, and penalties may include fines and jail. Police have said they do not intend to charge people who were genuinely tricked, and people whose accounts are restricted keep basic banking and can appeal. That is why coming forward early matters.',
          source: 'SPF, CDSA and CMA amendments (in force 8 Feb 2024); MHA written reply, 15 Oct 2025',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Ren is panicking. What now?',
          options: [
            { id: 'r-tell', text: 'Stop moving any money, tell his mum, then call Harbour Bank on the number on his card and make a police report together.', good: true, response: 'That is the strongest move. Coming forward early helps the bank and police, and shows Ren was tricked. Beacon lights up.', help: ['trusted-adult', 'bank', 'police-hotline'] },
            { id: 'r-delete', text: 'Delete the chats and hope it blows over.', good: false, response: "Wanting it to disappear is a normal reaction. But the chats are the evidence that Ren was tricked. It's not too late: telling someone is still the next step." },
            { id: 'r-mel', text: 'Call Mel\'s "compliance hotline" and ask them to fix it.', good: false, response: 'That number leads back to the people who used Ren\'s account, and they gain from him staying quiet. Go to people who can actually help: family, the bank and the police.' },
          ],
        },
      },
    },
    {
      id: 'ask-proof',
      label: 'Ask Mel for more proof first',
      safety: 'unsure',
      outcome: {
        title: 'More "proof" arrives',
        text: 'In seconds Mel sends a business registration screenshot, five-star reviews and a photo of a payslip. It all looks convincing, and all of it comes from Mel. None of it is independent.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to check the company yourself through an official source you find, not links, numbers or pictures the sender gives you',
        ifItHappened: 'stop replying, keep your bank details to yourself, tell a trusted adult and call the ScamShield Helpline 1799 to check.',
      },
    },
    {
      id: 'think',
      label: 'Reply "I\'ll think about it"',
      safety: 'unsure',
      outcome: {
        title: '"Last chance"',
        text: 'Mel sends a voice note: "Other people are waiting. Last chance, 5 mins." Dev nudges Ren again. The pressure just got louder, and the question is still open.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to pause and then act: say no, stop replying and tell someone. Holding means pausing first, not stalling',
        ifItHappened: 'stop replying now, keep the messages and tell a trusted adult. It is never too late to say no.',
      },
    },
    {
      id: 'refuse-tell',
      label: 'Say no, stop replying, and tell a trusted adult',
      safety: 'safe',
      outcome: {
        title: 'Ren walks away',
        text: 'Ren replies "Not interested", blocks Mel and keeps the chat as evidence. He tells Auntie May at the letterboxes, who helps him report it in the ScamShield app. Then they talk about rent: she knows a bakery nearby that is hiring. Dev goes quiet, for now.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to refuse, keep the messages as evidence, and check with the ScamShield Helpline 1799 if you are unsure',
        ifItHappened: "don't move any money that arrived from someone you don't know. Tell your bank and the police.",
      },
      aftershock: {
        id: 'afterglow-warning',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: Harbour Bank flags Mel',
        text: 'Harbour Bank flags the account Mel was using. Ren\'s report helped other students get a warning, and two classmates who had the same message block Mel straight away.',
        effects: { trust: 1 },
        fact: {
          text: 'Singapore Police: "Payment accounts, Singpass credentials, and SIM cards are strictly for personal use only."',
          source: 'SPF, Annual Scam and Cybercrime Brief 2025 (25 Feb 2026)',
          asOf: '2026-10-08',
        },
      },
    },
  ],
  perspectives: [
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-tell', text: 'Every bit of proof came from Mel, and the profile is three days old. There is nothing we can check ourselves.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'think', text: 'Ren really needs the rent money, and Dev is his friend. Saying "I\'ll think about it" buys time without embarrassing Dev.' },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-tell', text: "A job that only needs your bank account isn't a job. The account is the product." },
  ],
  peerShield: {
    friend: 'dev',
    timeLabel: '2AM, THREE WEEKS LATER',
    setup:
      "2am. Dev messages Ren from his bed, curled up with the phone glowing. His own account has been frozen, the bank wants to talk, and Mel wants two more recruits \"to sort it out\". He's scared.",
    messages: [
      { from: 'dev', text: 'bro my bank account kena frozen. bank says police might contact me' },
      { from: 'dev', text: 'I only did it twice. Mel says bring 2 more ppl then can sort it out' },
      { from: 'dev', text: "don't tell anyone pls" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-glad', text: "Thanks for telling me. I'm here.", quality: 'great', why: 'Thanking him for speaking up lowers his guard.', guard: -20, doubt: 5 },
        { id: 'o-wait', text: "OK wait, let's think about this.", quality: 'ok', why: 'Calm, but it does not make him feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-told', text: 'Told you it was dodgy.', quality: 'harmful', why: 'Blame makes people defensive and more likely to hide the problem.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-target', text: "The people who recruited you used you. That's on them. Telling the bank the truth early helps.", quality: 'great', why: 'Blames the scheme, not him, and gives a clear reason to come forward.', guard: -5, doubt: 25 },
        { id: 'r-fact', text: 'Banks freeze accounts that moved scam money.', quality: 'ok', why: 'True, but on its own it sounds like a verdict. He needs to hear that the blame sits with the people who used him.', guard: 0, doubt: 10 },
        { id: 'r-two', text: 'Just get 2 more people like Mel says, then quit.', quality: 'harmful', why: 'This pulls more friends into the same risk, and Mel cannot unfreeze anything.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-come', text: "I won't spread it around. But this needs someone who can help, and I'll come with you when you call the bank.", quality: 'great', why: 'Respects his privacy without keeping a harmful secret, and makes the next step easier.', guard: -10, doubt: 15 },
        { id: 'f-help', text: 'You can ask someone for help.', quality: 'ok', why: 'Kind, but it leaves him to do it alone at 2am.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Don't worry, I won't tell anyone.", quality: 'harmful', why: 'A secrecy pact is exactly what the scheme needs.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-bank', text: 'Call Harbour Bank on the number on your card or in its app, and tell your parents. A police report helps show you were tricked.', quality: 'great', why: 'Points to official channels he can trust, and a trusted adult.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Maybe search online what to do?', quality: 'ok', why: 'Searching can lead to more fake "helpers". Official channels are safer.', guard: 0, doubt: 0 },
        { id: 'c-kel', text: "Call Mel's compliance hotline, they'll sort it out.", quality: 'harmful', why: 'A decoy channel: that number belongs to the people who benefit from Dev staying in.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Dev: "ok. can you come with me tomorrow when I call the bank? thanks for not scolding me." He stops recruiting. In the morning, Dev and his mum call Harbour Bank together.',
      partial: 'Dev: "ok maybe." He is thinking about it. Checking in again in the morning could help.',
      fail: 'Dev: "forget it, I\'ll handle it myself." Seen.',
    },
  },
  ifThen: {
    if: 'someone offers me money to use my bank account, Singpass or SIM card',
    then: 'say no, keep the messages, and tell a trusted adult or call 1799 to check',
  },
  help: ['scamshield-1799', 'bank', 'police-hotline', 'trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'CDSA and CMA amendments: money mule offences, in force 8 Feb 2024', publisher: 'Singapore Police Force', asOf: '2026-10-08', url: 'https://www.police.gov.sg/knowledge-hub/legislation/cdsa-and-cma-bill-amendments' },
    { label: 'Facility Restriction Framework for money mules (from 1 Oct 2025)', publisher: 'SPF Mid-Year Scam and Cybercrime Brief 2026', asOf: '2026-10-08' },
    { label: 'Written reply on people deceived into providing accounts (15 Oct 2025)', publisher: 'Ministry of Home Affairs', asOf: '2026-10-08' },
    { label: 'Annual Scam and Cybercrime Brief 2025 (25 Feb 2026): "strictly for personal use only" quote', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Advisory: call your bank immediately and make a police report (12 Mar 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
