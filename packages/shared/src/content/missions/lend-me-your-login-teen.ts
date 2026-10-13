import type { Mission } from '../../mission';

// M04 Lend Me Your Login, 14-16 variant "Borrow your EduPass for a quick job" (GAME_DESIGN.md §9.2), at a
// secondary-school gate. Same deep structure as the 17-24 primary (lend-me-your-login.ts): lending your login lets
// someone act in your name. 14-16 consequence wording is simplified (investigation, parents told), with no penalty
// figures. EduPass is a fictional student login and is never drawn to look like a real one.

export const lendMeYourLoginTeen: Mission = {
  id: 'lend-me-your-login-teen',
  version: 1,
  title: 'Borrow Your EduPass',
  district: 'school-street',
  scene: 'school-gate',
  bands: ['teen'],
  theme: 'Digital identity',
  premise:
    'Nisha is saving for concert tickets. A TaskLah "quick job" pays S$30 for an hour, and she does not even have to do anything. Just lend them her EduPass login.',
  skillFocus: ['I', 'E'],
  timeOfDay: 'afternoon',
  scaffold: 'wildcard',
  resident: 'nisha',
  cast: [
    { id: 'nisha', name: 'Nisha', role: 'resident', anchor: 'bench', pose: 'phone', look: { body: '#34d399', accent: '#064e3b', hair: 'long' } },
    { id: 'ethan', name: 'Ethan', role: 'pressurer', anchor: 'bus-stop', pose: 'lean', look: { body: '#f97316', accent: '#7c2d12', hair: 'short' } },
    { id: 'vee', name: 'Vee | TaskLah Jobs', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'mr-tan', name: 'Mr Tan', role: 'trusted', anchor: 'gate', pose: 'stand', look: { body: '#60a5fa', accent: '#1e3a8a', hair: 'short' } },
  ],
  intro:
    '3.30pm at the school gate. Nisha, 15, is saving up for concert tickets. She sits on the bench checking TaskLah for small jobs, while her classmate Ethan waits for the bus.',
  live: {
    durationSec: 52,
    decisionPrompt: 'The code is on Nisha\'s screen and Vee is waiting. What should Nisha do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Nisha\'s phone buzzes. A TaskLah message from "Vee | TaskLah Jobs".' },
      { id: 'b2', at: 4, from: 'vee', channel: 'chat', text: "Hi Nisha! Quick student job: S$30 for 1 hour, and you don't even need to do anything 😄", tactic: 'too-good', attachment: { kind: 'job', label: 'Student App Tester', detail: '1 hour · S$30 · just lend your login' } },
      { id: 'b3', at: 9, from: 'vee', channel: 'chat', text: 'Just send your EduPass ID and password. We log in on our side to test our app with real student accounts.', tactic: 'small-ask' },
      { id: 'b4', at: 14, from: 'ethan', channel: 'speech', text: 'My brother did it last month. Easy money sia, he got new earbuds.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 19, from: 'vee', channel: 'chat', text: "You'll get a 6-digit EduPass code by SMS. Send me that too so we can get in." },
      { id: 'b6', at: 23, from: 'narrator', channel: 'notification', text: 'SMS: Your EduPass code is 305 621. Never share this code. EduPass will never ask you for it.', attachment: { kind: 'code', label: 'EduPass code', detail: "Sent to Nisha's phone" } },
      { id: 'b7', at: 28, from: 'nisha', channel: 'chat', text: "Why do you need my real account? Can't you make a test one?" },
      { id: 'b8', at: 32, from: 'vee', channel: 'chat', text: "Test accounts don't work lah. We work with schools all the time, totally official 👍", tactic: 'authority', attachment: { kind: 'image', label: 'partner_badge.png', detail: 'An "EduPass Partner" badge with a gold tick' } },
      { id: 'b9', at: 37, from: 'narrator', channel: 'notification', text: 'TaskLah, new job: Weekend crew at Boba Boleh. Apply in the shop, short interview, paid by the hour.', attachment: { kind: 'job', label: 'Weekend crew (part-time)', detail: 'Apply in the shop · interview · hourly pay' } },
      { id: 'b10', at: 42, from: 'vee', channel: 'chat', text: "Don't tell your parents or teachers k. Other students will want your spot.", tactic: 'secrecy' },
      { id: 'b11', at: 47, from: 'vee', channel: 'chat', text: 'Need the code in 3 mins. 2 other students are waiting.', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-pay', label: 'S$30 for doing "nothing"', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: "If Nisha doesn't have to do anything, what is Vee paying for? The answer is her account." },
    { id: 'c-login', label: "Vee wants Nisha's EduPass ID and password", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, tactic: 'small-ask', explain: 'Your login is you, online. Whoever has it can sign in as Nisha and use her name for things she never agreed to.' },
    { id: 'c-code', label: 'Vee also wants the code sent to her phone', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, explain: 'The SMS code is the last lock on her account. Even the SMS says never share it. Anyone who asks for it wants to get past that lock.' },
    { id: 'c-badge', label: '"We work with schools, totally official"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'authority', explain: 'Saying it does not make it true, and badges are easy to copy. A real school partner would never need a student\'s password.' },
    { id: 'c-secret', label: '"Don\'t tell your parents or teachers"', target: { kind: 'beat', beatId: 'b10' }, redFlag: true, tactic: 'secrecy', explain: 'Vee wants to keep away the people who would spot the trick. When someone says "don\'t tell", that is the time to tell.' },
    { id: 'c-rush', label: '"Need the code in 3 mins"', target: { kind: 'beat', beatId: 'b11' }, redFlag: true, tactic: 'urgency', explain: 'The rush stops Nisha from asking anyone. A real job can wait for her to check.' },
    { id: 'c-new', label: 'Up close on Nisha\'s screen: Vee\'s profile says "Joined 4 days ago"', target: { kind: 'anchor', anchor: 'bench' }, redFlag: true, explain: 'A "school partner" with a four-day-old profile. New profiles are easy to make, and easy to delete once people report them.' },
    { id: 'c-brother', label: 'Ethan\'s phone: his brother\'s message, "my EduPass kena locked"', target: { kind: 'anchor', anchor: 'bus-stop' }, redFlag: true, explain: 'Ethan\'s brother did the same "easy" job. Now his EduPass is locked and he has to go to the school office to explain. Ethan has not put it together yet.' },
    { id: 'c-question', label: 'Nisha asks why they need her real account', target: { kind: 'beat', beatId: 'b7' }, redFlag: false, explain: 'Asking is a good move, not a warning sign. But notice that every answer comes from Vee, so none of it can be checked.' },
    { id: 'c-job', label: 'A Boba Boleh job with an interview', target: { kind: 'beat', beatId: 'b9' }, redFlag: false, explain: 'Not a red flag. This is what a real job looks like: you apply, you meet people, and you are paid for real work. It never needs your login.' },
  ],
  influence: {
    from: 'ethan',
    hidden: {
      label: "Vee's login-borrowing network",
      description: "The network collects student logins and uses them to open accounts in the students' names. Scammers use those accounts, so the trail leads to the students, not to Vee.",
    },
    question: 'Pull the thread from Ethan. Who really gains if Nisha sends her login and the code?',
    options: [
      { id: 'i-ethan', text: 'Ethan. He gets paid for bringing in friends.', correct: false, explain: "Ethan isn't gaining anything. He is repeating what his brother told him, and his brother is already in trouble." },
      { id: 'i-network', text: 'A network that uses student logins to open accounts, so the trail leads to the students.', correct: true, explain: "Right. The network stays hidden, and Nisha's name is the one on record." },
      { id: 'i-app', text: 'An app company that really needs student testers.', correct: false, explain: 'Real app companies make their own test accounts. None of them need your password and your code.' },
    ],
  },
  forecast: {
    question: 'If Nisha sends her login and the code, what is most likely by next month?',
    horizon: 'next-month',
    options: [
      { id: 'f-paid', text: 'She keeps the S$30 and nothing else happens.', likely: false },
      { id: 'f-locked', text: 'Her EduPass is locked because it was used to open an account linked to scams, and her parents are told.', likely: true },
      { id: 'f-weekly', text: 'Vee pays her S$30 every week.', likely: false },
    ],
    explain: 'Her login and code let someone act as Nisha. Accounts opened that way get used for scams, and checks start with the name on the account.',
  },
  choices: [
    {
      id: 'lend-login',
      label: 'Send the login and the code, and take the S$30',
      safety: 'risky',
      outcome: {
        title: '+S$30',
        text: 'Nisha sends her EduPass details and the code. S$30 lands in her LumenPay wallet. Vee replies "You\'re a star ⭐" and Ethan grins. That was easy.',
        mood: 'shiny',
        effects: { wallet: 30 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to never share your login or a code from your SMS, whatever the pay',
        ifItHappened: 'tell a parent or teacher straight away, change your EduPass password with them on the official site, and report it. Coming forward early helps.',
      },
      aftershock: {
        id: 'edupass-locked',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '3 WEEKS LATER',
        title: "Nisha's EduPass is locked",
        text: "Nisha can't log in to EduPass. A letter comes home: her EduPass was used to open a LumenPay wallet linked to scams. Her account is locked while police look into it, and her parents have been told. Nisha never opened that wallet. Someone used her login to do it.",
        effects: { trust: -2, risk: 2 },
        fact: {
          text: 'In Singapore, giving your digital ID login to someone so they can commit an offence can be a crime. The law is not meant to punish people who were genuinely tricked, so telling the truth early matters.',
          source: 'SPF, CDSA and CMA amendments (in force 8 Feb 2024); MHA, commencement of the amendments (8 Feb 2024)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Nisha feels sick with worry. What now?',
          options: [
            { id: 'r-tell', text: 'Tell her parents everything, show them the chats, and make a police report together.', good: true, response: 'That is the strongest move. The chats show Nisha was tricked, and coming forward early helps the police find the people who used her login. Beacon lights up.', help: ['trusted-adult', 'police-hotline', 'scamshield-1799'] },
            { id: 'r-delete', text: 'Delete the chats so nobody finds out.', good: false, response: 'Wanting it all to go away is a normal feeling. But the chats are the proof that Nisha was tricked. It is not too late: telling her parents is still the next step.' },
            { id: 'r-vee', text: 'Message Vee and ask him to close the wallet.', good: false, response: 'Vee gains from Nisha staying quiet, and he may ask for more. Go to the people who can actually help: her parents, a teacher and the police.' },
          ],
        },
      },
    },
    {
      id: 'ask-proof',
      label: 'Ask Vee to prove the job is real first',
      safety: 'unsure',
      outcome: {
        title: 'More "proof" arrives',
        text: 'Vee sends a company certificate, five-star reviews and a video of students "getting paid". It all looks real, and all of it comes from Vee. The code is still on Nisha\'s screen.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to check jobs yourself through sources you find, and to remember that no real job needs your password or your code',
        ifItHappened: 'stop replying, keep your login to yourself and tell a parent or teacher. If you already sent anything, change your password with them straight away.',
      },
    },
    {
      id: 'refuse-tell',
      label: 'Say no, block Vee, screenshot the chat and tell a teacher',
      safety: 'safe',
      outcome: {
        title: 'Nisha keeps her login',
        text: 'Nisha replies "No thanks", screenshots the chat and blocks Vee. She shows Mr Tan at the gate. He helps her report the profile on TaskLah and warns the school. Ethan shrugs, but he is listening. Then Nisha looks up the Boba Boleh job.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to keep your login and codes to yourself, screenshot the chat and tell a trusted adult',
        ifItHappened: 'tell a parent or teacher straight away and change your password with them. Coming forward early helps show you were tricked.',
      },
      aftershock: {
        id: 'afterglow-school-warning',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'THE NEXT WEEK',
        title: 'Afterglow: the school warning works',
        text: "The school shares Nisha's screenshots, with names hidden, in a notice to all students. Three students who got the same TaskLah message block Vee, and TaskLah removes his profile.",
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'lend-login', text: "Ethan's brother did it and got paid, and the concert is soon. Saying no feels like missing out on easy money that others are getting." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-tell', text: 'Even the SMS says never share the code. And everything that says this job is real comes from Vee.' },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-tell', text: 'Your login is your name online. Lending it means a stranger gets to use your name.' },
  ],
  peerShield: {
    friend: 'ethan',
    timeLabel: 'TWO WEEKS LATER, 10PM',
    setup: 'Now Vee has messaged Ethan: S$50 for his EduPass login and code. The code is on his screen, and he messages Nisha before he sends it.',
    messages: [
      { from: 'ethan', text: "vee says 50 bucks for my edupass. my bro's one was some mistake, this one is different" },
      { from: 'ethan', text: "I need it for the concert tix sia. it's just one login" },
      { from: 'ethan', text: "don't tell my parents ok" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-thanks', text: 'Thanks for telling me before you sent it.', quality: 'great', why: 'Thanking him for asking first lowers his guard.', guard: -20, doubt: 5 },
        { id: 'o-wait', text: 'Wait, hold on.', quality: 'ok', why: 'Calm, but it does not tell him you are on his side.', guard: -5, doubt: 5 },
        { id: 'o-shame', text: 'Are you serious? After what happened to your brother?', quality: 'harmful', why: 'Shame makes people defend themselves instead of thinking.', guard: 30, doubt: -5 },
      ],
      reason: [
        { id: 'r-name', text: "Vee wants your login so things get opened in your name, not his. That's on him, not you.", quality: 'great', why: 'Shows who really gains, and blames the trick instead of Ethan.', guard: -5, doubt: 20 },
        { id: 'r-lock', text: 'Lending logins can get your EduPass locked.', quality: 'ok', why: 'True, but he needs to see who gains, not just what could go wrong.', guard: 0, doubt: 10 },
        { id: 'r-once', text: 'Just do it once for the tickets, then block him.', quality: 'harmful', why: '"Just once" is all Vee needs. One login is enough to open an account in his name.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-job', text: "Let's find a weekend job together. I'll come with you to ask at Boba Boleh.", quality: 'great', why: 'A real offer that also helps with the real problem: the ticket money.', guard: -10, doubt: 10 },
        { id: 'f-parents', text: 'Maybe ask your parents for the ticket money?', quality: 'ok', why: 'Kind, but it leaves him on his own with it tonight.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Ok, I won't tell anyone. Your call.", quality: 'harmful', why: 'A secret pact is exactly what Vee needs.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-teacher', text: "Don't send anything. Screenshot it, block Vee, and let's show Mr Tan tomorrow.", quality: 'great', why: 'A clear next step, with a trusted adult who can actually help.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Maybe search online if Vee is legit?', quality: 'ok', why: 'Fake reviews are easy to find. A trusted adult is a safer check.', guard: 0, doubt: 0 },
        { id: 'c-call', text: "Ask Vee to video call and prove he's real.", quality: 'harmful', why: 'A decoy check: proof from the person asking is not proof, and it keeps Ethan talking to Vee.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Ethan: "ok I blocked him. can we see Mr Tan before class tmr?" He also tells his brother to talk to their parents.',
      partial: 'Ethan: "ok I won\'t send it yet." The code is still on his screen. Checking in tomorrow could help.',
      fail: 'Ethan: "whatever, you sound like my mum." Seen. Nisha can still tell Mr Tan tomorrow, so Ethan gets help.',
    },
  },
  ifThen: {
    if: 'someone offers me money to borrow my login, or asks for a code sent to my phone',
    then: 'say no, keep the messages, and tell a trusted adult or call 1799 to check',
  },
  help: ['trusted-adult', 'scamshield-1799', 'police-hotline', 'mindline-1771'],
  sources: [
    { label: 'CDSA and CMA Bill amendments: digital ID offences, in force 8 Feb 2024', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Commencement of amendments to the CMA and CDSA (8 Feb 2024)', publisher: 'Ministry of Home Affairs', asOf: '2026-10-08' },
    { label: 'Advisory on the compromise of WhatsApp accounts: never share one-time codes (12 Mar 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'ScamShield Helpline 1799; Police Hotline 1800 255 0000', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
    { label: 'Get support from our partners (mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
