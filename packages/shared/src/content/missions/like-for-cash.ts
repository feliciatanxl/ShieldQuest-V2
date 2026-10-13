import type { Mission } from '../../mission';

// M12 Like-for-Cash (GAME_DESIGN.md §9.2): a job/task scam run from Digi Sky's QuikGig tower (the GDD pairs it with
// the void deck; one scene is used here). The first S$15 really is paid: that is the immediate reward the Delayed
// Consequence Engine later turns. A wildcard mission: an unfamiliar surface with the same deep structure as M09
// (easy money first, then the real ask).

export const likeForCash: Mission = {
  id: 'like-for-cash',
  version: 1,
  title: 'Like-for-Cash',
  district: 'digi-district',
  scene: 'digi-sky',
  bands: ['young-adult', 'teen'],
  theme: 'Job and task scam',
  premise: 'Wei Ling joined a TaskLah group that pays S$5 for every hotel review she "likes". The first S$15 really arrived. Now there is a Premium task, and it costs S$100 to unlock.',
  skillFocus: ['E', 'H', 'L'],
  timeOfDay: 'night',
  scaffold: 'wildcard',
  resident: 'weiling',
  cast: [
    { id: 'weiling', name: 'Wei Ling', role: 'resident', anchor: 'chatlah-plaza', pose: 'phone', look: { body: '#f9a8d4', accent: '#9d174d', hair: 'long' } },
    { id: 'amy', name: 'TaskLah_Mentor_Amy', role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'jasmine', name: 'Jasmine88', role: 'stranger', faceless: true, look: { body: '#475569', accent: '#1e293b', hair: 'none' } },
    { id: 'ben', name: 'BenTan_Earns', role: 'stranger', faceless: true, look: { body: '#475569', accent: '#1e293b', hair: 'none' } },
    { id: 'kiran', name: 'Kiran', role: 'friend', anchor: 'arcade', pose: 'lean', look: { body: '#fdba74', accent: '#7c2d12', hair: 'short' } },
  ],
  intro: 'Digi Sky, 10pm. Wei Ling, 21, is saving for a laptop. Yesterday she found a TaskLah group through an ad on the QuikGig tower. It pays S$5 for every hotel review she "likes". Her friend Kiran is at the Arcade next door.',
  live: {
    durationSec: 57,
    decisionPrompt: 'The Premium slot is closing. What should Wei Ling do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'The TaskLah group chat glows above the QuikGig tower. The app looks slick and professional.' },
      { id: 'b2', at: 4, from: 'amy', channel: 'chat', text: 'Task 3 done! S$15 sent to your MetroPay 🎉', tactic: 'too-good', attachment: { kind: 'payment', label: 'MetroPay: +S$15.00', detail: 'From: TaskLah Rewards' } },
      { id: 'b3', at: 9, from: 'jasmine', channel: 'chat', text: 'Wah just got S$300 commission today! Thank you Mentor Amy 🙏', tactic: 'fake-proof', attachment: { kind: 'screenshot', label: 'payout.png', detail: 'Commission received: S$300' } },
      { id: 'b4', at: 14, from: 'amy', channel: 'chat', text: 'Wei Ling, you are selected for a Premium task! Top up S$100 to unlock S$300 commission.', tactic: 'small-ask', attachment: { kind: 'job', label: 'Premium task', detail: 'Top up S$100 · earn S$300' } },
      { id: 'b5', at: 20, from: 'ben', channel: 'chat', text: 'Premium done, withdrew S$480 😍 so easy', tactic: 'everyone-does-it' },
      { id: 'b6', at: 25, from: 'weiling', channel: 'chat', text: 'Can I top up later, after I withdraw?' },
      { id: 'b7', at: 30, from: 'amy', channel: 'chat', text: 'Withdrawals unlock only after the Premium task. System rule, sorry dear 🙏' },
      { id: 'b8', at: 36, from: 'amy', channel: 'chat', text: 'Only 2 Premium slots left today. Offer ends in 10 min ⏰', tactic: 'urgency' },
      { id: 'b9', at: 41, from: 'jasmine', channel: 'chat', text: "Don't overthink! I topped up S$100 and got S$300 back in 5 mins!!", tactic: 'everyone-does-it' },
      { id: 'b10', at: 47, from: 'amy', channel: 'chat', text: "Don't tell your family ok, they'll make you miss this chance 😉", tactic: 'secrecy' },
      { id: 'b11', at: 52, from: 'amy', channel: 'chat', text: 'Wei Ling? Slot closing soon...', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-paid', label: 'S$15 paid for three taps', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Real money for almost no work. Paying a little first is how this trick builds trust before it asks for more.' },
    { id: 'c-payouts', label: 'Payout screenshots posted in the group', target: { kind: 'beat', beatId: 'b3' }, redFlag: true, tactic: 'fake-proof', explain: 'The screenshots come from accounts inside the group, and anyone can edit a screenshot. They are there to make paying feel normal.' },
    { id: 'c-topup', label: 'Pay S$100 to earn S$300', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'small-ask', explain: 'A job pays you. It never asks you to pay first. "Top up to earn" is the heart of a task scam.' },
    { id: 'c-withdraw', label: "Can't withdraw until she tops up", target: { kind: 'beat', beatId: 'b7' }, redFlag: true, explain: "If you can't take money out until you put more in, the balance on screen isn't really yours. It's a hook." },
    { id: 'c-slots', label: '"2 slots left, 10 minutes"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'urgency', explain: 'The countdown is there so Wei Ling decides before she can check or talk to anyone.' },
    { id: 'c-secret', label: '"Don\'t tell your family"', target: { kind: 'beat', beatId: 'b10' }, redFlag: true, tactic: 'secrecy', explain: 'A real job has nothing to hide from your family. Being told to keep quiet is the moment to tell someone.' },
    { id: 'c-members', label: 'The member list, up close: all 48 members joined the same week', target: { kind: 'anchor', anchor: 'quikgig-tower' }, redFlag: true, explain: 'A busy group where everyone arrived in the same week. Most "members" are likely run by the same people, there to cheer and post payouts.' },
    { id: 'c-slick', label: 'A slick, professional-looking app', target: { kind: 'beat', beatId: 'b1' }, redFlag: false, explain: 'Not a warning sign by itself, but not proof either. Good design is cheap to copy. Judge what the job asks of you.' },
    { id: 'c-cafe', label: 'A Boba Boleh job ad: "Part-time crew. Apply on our website, interview in store."', target: { kind: 'anchor', anchor: 'link-portal' }, redFlag: false, explain: 'This is what a real job looks like: you apply on the company\'s own site, you meet them, and they pay you. Nobody asks you to pay first.' },
  ],
  influence: {
    from: 'amy',
    hidden: { label: 'One task-scam team', description: 'One team runs the group. Most "members" are its own accounts, and every top-up goes straight to them.' },
    question: 'Pull the thread from "Mentor Amy". Who is really in this group, and where do the top-ups go?',
    options: [
      { id: 'i-company', text: 'A marketing company that pays for hotel reviews.', correct: false, explain: 'A real company would not need you to pay first, or ask you to hide it from your family.' },
      { id: 'i-team', text: 'One scam team. Most "members" are their accounts, and every top-up goes to them.', correct: true, explain: 'Right. The cheering, the screenshots and the "mentor" are one team. The first S$15 was bait to win trust.' },
      { id: 'i-members', text: 'Other students like Wei Ling, earning side income.', correct: false, explain: 'Everyone joined the same week, and the screenshots all come from inside the group. They are part of the show.' },
    ],
  },
  forecast: {
    question: 'If Wei Ling tops up S$100, what is most likely by next week?',
    horizon: 'next-week',
    options: [
      { id: 'f-paid', text: 'She gets S$300 and withdraws it.', likely: false },
      { id: 'f-more', text: 'She is asked to top up more and more before she can withdraw anything.', likely: true },
      { id: 'f-refund', text: 'TaskLah refunds her and closes the group.', likely: false },
    ],
    explain: 'Task scams pay small sums first, then ask for bigger and bigger top-ups. The withdraw button never really works.',
  },
  choices: [
    {
      id: 'top-up',
      label: 'Top up S$100 for the Premium task',
      safety: 'risky',
      outcome: {
        title: 'Balance: S$415',
        text: 'The dashboard flashes "Commission S$300 (pending)". Amy sends 🎉 and the group cheers. On screen, Wei Ling just tripled her money.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to never pay money to earn money. A real job pays you, it does not charge you',
        ifItHappened: 'stop paying, keep the chats, tell someone you trust, then call your bank and make a police report.',
      },
      aftershock: {
        id: 'top-up-trap',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '5 DAYS LATER',
        title: '"Top up to withdraw"',
        text: 'To withdraw, Wei Ling was told to top up S$300 more, then S$800 "to fix an error". She paid the S$300. Now the account says "Frozen for tax". Amy has left the group, and S$400 of her laptop savings is gone.',
        effects: { wallet: -400, trust: -2, risk: 2 },
        fact: {
          text: 'Job scams: 5,575 cases and about S$123.5 million lost in Singapore in 2025. Small commissions come first, then bigger and bigger demands.',
          source: 'SPF, Annual Scam and Cybercrime Brief 2025 (25 Feb 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Wei Ling feels sick about the money. What now?',
          options: [
            { id: 'r-stop', text: 'Stop paying, keep the chats, tell her sister, call her bank about the transfers and make a police report.', good: true, response: 'That is the strongest move. Stopping now protects the rest of her savings, and a report helps police follow the money. Beacon lights up.', help: ['trusted-adult', 'bank', 'police-hotline', 'scamshield-1799'] },
            { id: 'r-tax', text: 'Pay the "tax" just once more to get everything back.', good: false, response: 'That is the same trick asking again. No amount unlocks it. It is not too late to stop, keep the chats and tell someone.' },
            { id: 'r-agent', text: 'Pay a "fund recovery agent" who just messaged her.', good: false, response: 'People who just lost money are often targeted again by fake recovery offers. Telling her sister is a good first step. The real routes are her bank and the police, and they never charge a fee to help.' },
          ],
        },
      },
    },
    {
      id: 'withdraw-first',
      label: 'Ask Amy to let her withdraw first',
      safety: 'unsure',
      outcome: {
        title: '"Of course dear!"',
        text: 'Amy replies in seconds: "Sure! Finish Premium, then withdraw everything 😊". The rule has not changed, the timer is still running, and there is nothing Wei Ling can check.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to stop the moment any job asks you to pay. A balance on their screen is not money in your account',
        ifItHappened: "stop, don't top up, leave the group and call the ScamShield Helpline 1799 to check.",
      },
    },
    {
      id: 'stop-tell',
      label: 'Stop, keep the chats, leave the group and tell someone',
      safety: 'safe',
      outcome: {
        title: 'Wei Ling logs off',
        text: 'Wei Ling screenshots the chat, leaves the group and reports it in the ScamShield app. She tells her sister, who says, "Good call." The laptop fund stays where it is.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to stop, keep the chats, leave the group, and tell someone you trust',
        ifItHappened: 'stop paying, keep the chats, and call your bank and the police. If unsure, call the ScamShield Helpline 1799 first.',
      },
      aftershock: {
        id: 'afterglow-cca',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: one friend skips it',
        text: 'Wei Ling posts in her CCA chat: "If a job asks you to top up, it\'s a scam." Her coursemate Zul had just been invited to the same TaskLah group. He leaves before paying anything.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'stop-tell', text: 'A job pays you. The moment it asks you to pay, it is not a job.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'stop-tell', text: 'Every member joined the same week, and all the payout screenshots come from the group itself.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'withdraw-first', text: "She really did get S$15, so it isn't all fake. Testing a withdrawal before deciding seems fair." },
  ],
  peerShield: {
    friend: 'kiran',
    timeLabel: 'TWO WEEKS LATER',
    setup: 'Late at night, Kiran messages Wei Ling. He joined a TaskLah group too. He already got S$20, and now he is being asked to top up S$150.',
    messages: [
      { from: 'kiran', text: 'WL!! I already earned S$20 from TaskLah' },
      { from: 'kiran', text: 'now they say top up S$150 to unlock S$450. got screenshots from others' },
      { from: 'kiran', text: "my parents will say no so I'm not telling them" },
    ],
    start: { guard: 60, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-thanks', text: 'Thanks for telling me before you paid. Can I see the chat?', quality: 'great', why: 'Thanks him for asking, and opens a calm look together.', guard: -20, doubt: 10 },
        { id: 'o-hmm', text: 'Hmm, okay.', quality: 'ok', why: 'Not unkind, but it does not slow him down.', guard: -5, doubt: 5 },
        { id: 'o-obvious', text: 'Wah, you also? That one so obvious lah.', quality: 'harmful', why: 'Shame makes him defensive, and more likely to top up to prove you wrong.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-pay', text: "A real job pays you. It never asks you to pay first. The S$20 is bait. That's how they hook people.", quality: 'great', why: 'Names the trick and blames the scammers, not Kiran.', guard: -5, doubt: 25 },
        { id: 'r-sus', text: 'Sounds a bit sus.', quality: 'ok', why: 'True, but vague. He needs a reason.', guard: 0, doubt: 10 },
        { id: 'r-try', text: 'Try once with S$150. If can withdraw, then OK lor.', quality: 'harmful', why: 'Testing it is exactly the next step the scam wants.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-leave', text: "Let's screenshot the chat and leave the group together, now.", quality: 'great', why: 'A concrete offer to do the safe step together.', guard: -10, doubt: 15 },
        { id: 'f-think', text: 'Maybe think about it first?', quality: 'ok', why: 'Kind, but it leaves him alone with the countdown.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "OK, I won't tell anyone.", quality: 'harmful', why: 'A secrecy pact keeps away the people who could help.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-1799', text: "If you're not sure, we call ScamShield 1799 together. Your parents will be glad you asked.", quality: 'great', why: 'Points to an official helpline and a trusted adult, without blame.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Search the group name online.', quality: 'ok', why: 'It may help, but these groups change names often.', guard: 0, doubt: 5 },
        { id: 'c-admin', text: "Ask the mentor if it's legit.", quality: 'harmful', why: 'A decoy: the mentor runs the scam and will say yes.', guard: 0, doubt: -10 },
      ],
    },
    outcomes: {
      success: 'Kiran: "ok... leaving the group now. glad I asked you first." He reports it too.',
      partial: 'Kiran: "ok, I\'ll wait." He hasn\'t left the group yet. Checking in tomorrow could help.',
      fail: 'Kiran: "you don\'t get it. I\'m topping up." Seen.',
    },
  },
  ifThen: {
    if: 'a job or task asks me to pay, top up or deposit before I can earn or withdraw',
    then: 'stop, keep the chats, leave, and tell someone or call 1799 to check',
  },
  help: ['scamshield-1799', 'scamshield-report', 'bank', 'police-hotline', 'trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'Annual Scam and Cybercrime Brief 2025 (25 Feb 2026): job scam cases and losses', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Advisory: call your bank immediately and make a police report (12 Mar 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'I can ACT against scams: Add, Check, Tell', publisher: 'ScamShield (scamshield.gov.sg)', asOf: '2026-10-08', url: 'https://www.scamshield.gov.sg' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
