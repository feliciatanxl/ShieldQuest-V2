import type { Mission } from '../../mission';

// M04 Lend Me Your Login (GAME_DESIGN.md §9.2), 17-24 primary, on the poly-gate dressing of the school-gate set.
// Digital identity: approving someone else's login on your own digital ID. CityPass is fictional and is never drawn
// to look like the real national digital ID. Same deep structure as Easy Money (lend what is yours, the trail leads
// back to you), so it works as the 17-24 Wildcard. The 14-16 variant "Borrow Your EduPass" lives in
// lend-me-your-login-teen.ts. Legal lines use "may" and "up to" only [S5, S6]; restrictions and passkeys [S4].

export const lendMeYourLogin: Mission = {
  id: 'lend-me-your-login',
  version: 1,
  title: 'Lend Me Your Login',
  district: 'school-street',
  scene: 'school-gate',
  bands: ['young-adult'],
  theme: 'Digital identity',
  premise:
    'Priya needs weekend work. A QuikGig "recruiter" offers S$80 for two minutes: just tap Approve on a CityPass login so his boss can register a company.',
  skillFocus: ['I', 'E'],
  timeOfDay: 'afternoon',
  scaffold: 'wildcard',
  resident: 'priya',
  cast: [
    { id: 'priya', name: 'Priya', role: 'resident', anchor: 'bench', pose: 'phone', look: { body: '#c084fc', accent: '#581c87', hair: 'long' } },
    { id: 'jaden', name: 'Jaden', role: 'pressurer', anchor: 'bus-stop', pose: 'lean', look: { body: '#fb7185', accent: '#881337', hair: 'cap' } },
    { id: 'kel', name: 'Kel | QuikGig Talent', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'ms-devi', name: 'Ms Devi', role: 'trusted', anchor: 'gate', pose: 'walk', look: { body: '#facc15', accent: '#713f12', hair: 'bun' } },
  ],
  intro:
    'Metro Poly main gate, 4.15pm. Priya, 20, is between classes, scrolling job apps for weekend work. Her friend Jaden is waiting at the bus stop when a message comes in.',
  live: {
    durationSec: 56,
    decisionPrompt: 'The CityPass request is waiting on Priya\'s screen. What should Priya do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Priya\'s phone buzzes. A QuikGig message from "Kel | QuikGig Talent", with a blue tick next to the name.' },
      { id: 'b2', at: 4, from: 'kel', channel: 'chat', text: "Hi Priya! Saw you're looking for weekend work. Got a quick one: S$80 for 2 mins, paid instantly 🙌", tactic: 'too-good', attachment: { kind: 'job', label: 'Account Setup Assistant (freelance)', detail: '2 mins · S$80 · no experience needed' } },
      { id: 'b3', at: 9, from: 'kel', channel: 'chat', text: "My boss is registering a company account. You'll get a CityPass login request on your phone. Just tap Approve, that's all.", tactic: 'small-ask' },
      { id: 'b4', at: 14, from: 'jaden', channel: 'speech', text: 'My cousin did one last month. Easy, two minutes only.', tactic: 'everyone-does-it' },
      { id: 'b5', at: 19, from: 'narrator', channel: 'notification', text: 'CityPass: Approve this login? Device: unknown. Location: not available. For: business registration.', attachment: { kind: 'code', label: 'CityPass login request', detail: 'Approve / Deny' } },
      { id: 'b6', at: 24, from: 'priya', channel: 'chat', text: 'Why does your boss need my CityPass to register his own company?' },
      { id: 'b7', at: 29, from: 'kel', channel: 'chat', text: "It's standard. We're an official CityPass partner, all above board 👍", tactic: 'authority', attachment: { kind: 'image', label: 'partner_badge.png', detail: 'A "CityPass Approved Partner" badge that looks a lot like the real CityPass logo' } },
      { id: 'b8', at: 34, from: 'narrator', channel: 'notification', text: 'QuikGig, new job near you: Library Assistant at Metro Poly. Send your CV, short interview on campus, S$9.50 an hour.', attachment: { kind: 'job', label: 'Library Assistant (part-time)', detail: 'CV + interview · S$9.50 an hour' } },
      { id: 'b9', at: 39, from: 'kel', channel: 'chat', text: 'Keep this between us ok? Competition is crazy, other agencies will steal our client.', tactic: 'secrecy' },
      { id: 'b10', at: 45, from: 'kel', channel: 'chat', text: 'The request expires in 3 mins. Tap Approve now pls 🙏', tactic: 'urgency' },
      { id: 'b11', at: 51, from: 'jaden', channel: 'speech', text: "Just tap lah. I already told Kel you're in. Don't make me look bad.", tactic: 'loyalty' },
    ],
  },
  clues: [
    { id: 'c-pay', label: 'S$80 for two minutes of "work"', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'No real job pays this much for one tap. The pay is bait, and it is high because the risk lands on Priya, not on Kel.' },
    { id: 'c-approve', label: 'The "job" is approving a login on Priya\'s own CityPass', target: { kind: 'beat', beatId: 'b3' }, redFlag: true, tactic: 'small-ask', explain: 'A CityPass login lets whoever holds it act as Priya: sign in, sign forms, open accounts. Tapping Approve for someone else hands them her identity.' },
    { id: 'c-blind', label: 'Login from an unknown device, location not available', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, explain: 'Priya cannot see who is logging in or where they are. Once she approves, she has no say in what they do in her name.' },
    { id: 'c-badge', label: 'An "official partner" badge, sent by Kel', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, tactic: 'authority', explain: 'Badges and logos are easy to copy, and this one came from the person asking. Real digital ID services never ask you to approve logins as a job. Check through a source you find yourself.' },
    { id: 'c-secret', label: '"Keep this between us... competition"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'secrecy', explain: '"Competition" is a cover story for secrecy. A real job never needs you to hide it from the people around you.' },
    { id: 'c-deadline', label: 'The request "expires in 3 mins"', target: { kind: 'beat', beatId: 'b10' }, redFlag: true, tactic: 'urgency', explain: 'The countdown keeps Priya from checking or asking anyone. A real opportunity can wait for her to check.' },
    { id: 'c-new', label: 'Up close on Priya\'s screen: Kel\'s profile says "Joined 4 days ago"', target: { kind: 'anchor', anchor: 'bench' }, redFlag: true, explain: 'An "official partner" whose recruiter profile is four days old. New profiles are cheap to make and easy to delete when reports start coming in.' },
    { id: 'c-cousin', label: 'Jaden\'s lock screen: an unread message from his cousin, "my CityPass kena locked"', target: { kind: 'anchor', anchor: 'bus-stop' }, redFlag: true, explain: 'Jaden\'s cousin did the same "easy" job last month. Now his CityPass is locked and he has to explain himself in person. Jaden has not opened the message yet.' },
    { id: 'c-job', label: 'A library job that asks for a CV and an interview', target: { kind: 'beat', beatId: 'b8' }, redFlag: false, explain: 'Not a red flag. This is what a real job looks like: you apply, you meet people, and you are paid by the hour for real work. Nothing about it needs your login.' },
    { id: 'c-poster', label: 'Kiosk poster: "Only approve logins you started yourself"', target: { kind: 'anchor', anchor: 'kiosk' }, redFlag: false, explain: 'Not a red flag. It is a resource: the rule in one line, plus a reminder that the ScamShield Helpline 1799 can help you check.' },
  ],
  influence: {
    from: 'jaden',
    hidden: {
      label: "Kel's account-opening network",
      description:
        'The network pays people to approve logins, then opens accounts in their names. Scammers use those accounts, and the trail leads back to whoever tapped Approve.',
    },
    question: 'Pull the thread from Jaden. Who really gains if Priya taps Approve?',
    options: [
      { id: 'i-jaden', text: 'Jaden. He gets a cut of her S$80.', correct: false, explain: "Jaden may get a small referral, but he is being used too. His cousin's locked CityPass shows where this road goes." },
      { id: 'i-network', text: "A network that opens accounts in other people's names, so the trail leads to Priya, not to them.", correct: true, explain: "Right. Borrowing a login is the whole point: the network stays hidden and Priya's name is on the record." },
      { id: 'i-boss', text: "Kel's boss, a small business that needs help with paperwork.", correct: false, explain: "A real business registers with its own owner's login. It never needs a stranger to approve it." },
    ],
  },
  forecast: {
    question: 'If Priya taps Approve, what is most likely by next month?',
    horizon: 'next-month',
    options: [
      { id: 'f-paid', text: 'She keeps the S$80 and never hears about it again.', likely: false },
      { id: 'f-letter', text: 'A letter says her CityPass was used to open an account linked to scams, and her CityPass is restricted.', likely: true },
      { id: 'f-hired', text: "Kel's company offers her a full-time job.", likely: false },
    ],
    explain: 'An approved login lets someone act as Priya. Accounts opened that way get used for scams, and checks start with the name on the account.',
  },
  choices: [
    {
      id: 'approve',
      label: 'Tap Approve and take the S$80',
      safety: 'risky',
      outcome: {
        title: '+S$80',
        text: 'Priya taps Approve. A minute later, S$80 lands in her MetroPay wallet. Kel sends a thumbs-up and Jaden grins. Two minutes, just like he said.',
        mood: 'shiny',
        effects: { wallet: 80 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to deny any login request you did not start yourself, whatever the pay, and to check job offers through sources you find yourself',
        ifItHappened: 'tell a trusted adult, make a police report and contact CityPass through its official site to lock your login. Coming forward early matters.',
      },
      aftershock: {
        id: 'citypass-restricted',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '3 WEEKS LATER',
        title: "Priya's CityPass is restricted",
        text: 'A letter arrives. Priya\'s CityPass was used to open an account linked to scams. She can no longer use her CityPass for some high-risk services while this is looked into, and police would like to speak with her. She never saw the account. She only tapped Approve.',
        effects: { trust: -2, risk: 2 },
        fact: {
          text: 'Since 8 Feb 2024, giving away your digital ID login (in real life, your Singpass) to help someone commit an offence can be a crime in Singapore. Penalties may include a fine of up to S$10,000, jail of up to 3 years, or both. The law is not meant to punish people who were genuinely tricked, so report it early. Restrictions can include using your digital ID for high-risk services.',
          source: 'SPF, CDSA and CMA amendments (in force 8 Feb 2024); MHA, commencement of the amendments (8 Feb 2024); SPF Mid-Year Scam and Cybercrime Brief 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: "Priya's hands are shaking. What now?",
          options: [
            { id: 'r-forward', text: 'Tell her family, keep the chats, make a police report and contact CityPass through its official site.', good: true, response: 'That is the strongest move. The chats show how she was tricked, and coming forward early helps the police and shows she did not know. Beacon lights up.', help: ['trusted-adult', 'police-hotline', 'scamshield-1799'] },
            { id: 'r-ignore', text: 'Ignore the letter. She never opened any account herself.', good: false, response: 'It feels unfair, and in a way it is: she never opened anything. But silence can look like hiding. Coming forward early is how she shows she was tricked, and a trusted adult can help her do it.' },
            { id: 'r-kel', text: 'Message Kel and demand he close the account.', good: false, response: "Kel gains from Priya staying quiet, and he may ask for more. It's not too late to go to the people who can actually help: her family, the police and CityPass's official helpdesk." },
          ],
        },
      },
    },
    {
      id: 'ask-proof',
      label: "Ask Kel for the company's registration first",
      safety: 'unsure',
      outcome: {
        title: 'A perfect certificate',
        text: "In seconds Kel sends a company registration: a business number, a stamp, a director's name. It looks real. It came from Kel, so it proves nothing, and the login request is still waiting.",
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to check a company yourself through an official source you find, and to deny any login you did not start',
        ifItHappened: 'deny the request, stop replying and tell a trusted adult. If you already tapped Approve, make a police report straight away.',
      },
    },
    {
      id: 'refuse-tell',
      label: 'Tap Deny, block Kel, keep the chat and tell a trusted adult',
      safety: 'safe',
      outcome: {
        title: 'Priya taps Deny',
        text: 'Priya taps Deny, screenshots the chat and blocks Kel. She shows Ms Devi, her course manager, at the gate. Together they report the profile on QuikGig and in the ScamShield app. Then Priya sends her CV for the library job. Jaden goes quiet, for now.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to deny any login you did not start yourself, keep the messages and report the profile',
        ifItHappened: 'tell a trusted adult and make a police report straight away. Coming forward early helps show you were tricked.',
      },
      aftershock: {
        id: 'afterglow-flagged',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: "Afterglow: Priya's report flags Kel",
        text: "QuikGig removes Kel's profile after several reports, Priya's among them. A warning goes out to Metro Poly students, and two of her classmates who got the same offer block him straight away.",
        effects: { trust: 1 },
        fact: {
          text: 'Tip: passkey logins resist phishing. But even a strong login can be misused if you approve a request that someone else started.',
          source: 'SPF, Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026)',
          asOf: '2026-10-08',
        },
      },
    },
    {
      id: 'think',
      label: 'Reply "Let me think about it"',
      safety: 'unsure',
      outcome: {
        title: '"Final offer"',
        text: 'Kel replies at once: "S$120, final offer. Request expires in 60 secs." A second CityPass request pops up. Jaden nudges her again. The pressure just got louder, and the request is still open.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to pause and then act: deny the request, stop replying and tell someone. Holding means pausing first, not stalling',
        ifItHappened: 'deny the request now, keep the messages and tell a trusted adult. It is never too late to say no.',
      },
    },
  ],
  perspectives: [
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'think', text: 'Jaden says his cousin did it and was fine, and Priya really needs the work. Asking for time feels fairer than calling his contact a scammer.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-tell', text: 'We cannot see who is logging in or from where, and the profile is four days old. None of this is something we can check ourselves.' },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-tell', text: 'A login is you. If a job only needs your login, your identity is the product.' },
  ],
  peerShield: {
    friend: 'jaden',
    timeLabel: '11PM, TWO WEEKS LATER',
    setup:
      'Kel has moved on to Jaden: S$120 to approve one login "for a partner". The CityPass request is open on his phone, and his hostel fees are due. Before he taps, he messages Priya.',
    messages: [
      { from: 'jaden', text: "kel offered me 120 to approve one login. my cousin's one was some mix-up, this one is different" },
      { from: 'jaden', text: "hostel fees due next week. it's literally one tap" },
      { from: 'jaden', text: "don't lecture me ok. and don't tell anyone" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-thanks', text: "Thanks for checking with me first. I'm not here to lecture.", quality: 'great', why: 'Thanking him for asking, and promising no lecture, lowers his guard.', guard: -20, doubt: 5 },
        { id: 'o-hold', text: 'Ok, hold on a sec.', quality: 'ok', why: 'Calm, but it does not tell him you are on his side.', guard: -5, doubt: 5 },
        { id: 'o-shame', text: 'Seriously? After what happened to your cousin?', quality: 'harmful', why: 'Shame makes people defensive, and defensive people stop listening.', guard: 30, doubt: -5 },
      ],
      reason: [
        { id: 'r-trail', text: "Kel needs your login so the account traces back to you, not him. That's his trick, and your cousin's lock is what it looks like later.", quality: 'great', why: 'Names who really gains and points at the scheme, not at Jaden.', guard: -5, doubt: 20 },
        { id: 'r-fact', text: 'Approving logins for strangers can get your CityPass restricted.', quality: 'ok', why: 'True, but on its own it sounds like a verdict, not a reason.', guard: 0, doubt: 10 },
        { id: 'r-once', text: 'Do it once for the fees, then block him.', quality: 'harmful', why: '"Just once" is the small first step the trick depends on. One approval is all Kel needs.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-jobs', text: "Let's look for proper part-time work together tomorrow. The library is still hiring.", quality: 'great', why: 'A concrete offer that also answers the real problem: the fees.', guard: -10, doubt: 10 },
        { id: 'f-parents', text: 'Maybe ask your parents to help with the fees?', quality: 'ok', why: 'Kind, but it leaves him to sort it out alone tonight.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Fine, I won't tell anyone. Your call.", quality: 'harmful', why: 'A secrecy pact is exactly what Kel needs.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-deny', text: "Tap Deny, block Kel, and let's report him in the ScamShield app. Not sure? Call 1799 to check.", quality: 'great', why: 'A clear next step and an official channel he can trust.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Maybe search online if Kel is legit?', quality: 'ok', why: 'Searching can lead to fake reviews and more "helpers". Official channels are safer.', guard: 0, doubt: 0 },
        { id: 'c-proof', text: 'Ask Kel to send his company papers first.', quality: 'harmful', why: 'A decoy check: proof from the person asking is not proof, and it keeps the request open.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Jaden: "ok. denied it. blocked him. can we look at the library job tomorrow?" He also forwards his cousin the ScamShield tips.',
      partial: 'Jaden: "ok I won\'t tap it yet." The request is still open. Checking in on him tomorrow could help.',
      fail: 'Jaden: "forget it, I\'ll decide myself." Seen. Priya can still check in tomorrow and report Kel\'s profile herself.',
    },
  },
  ifThen: {
    if: 'someone asks me to approve a login, share a code or lend my digital ID, even for pay',
    then: 'tap Deny, keep the messages, and tell a trusted adult or call 1799 to check',
  },
  help: ['scamshield-1799', 'scamshield-report', 'police-hotline', 'trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'CDSA and CMA Bill amendments: digital ID (Singpass) offences, in force 8 Feb 2024', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Commencement of amendments to the CMA and CDSA (8 Feb 2024)', publisher: 'Ministry of Home Affairs', asOf: '2026-10-08' },
    { label: 'Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026): digital ID restrictions; passkeys resist phishing', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'ScamShield app and website: check and report', publisher: 'ScamShield (scamshield.gov.sg), updated 23 Jul 2026', asOf: '2026-10-08' },
    { label: 'ScamShield Helpline 1799; Police Hotline 1800 255 0000', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
