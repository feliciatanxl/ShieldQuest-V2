import type { Mission } from '../../mission';

// M11 Parcel Re-delivery (GAME_DESIGN.md §9.2): courier-themed phishing at the neon void deck's phone kiosk.
// All three bands share the premise, so the text is kept plain enough for 10-13 with three exits. The quiet clue sits
// in the scene: Mei got the exact same text without ordering anything. Simulated texts never leave the game UI.

export const parcelRedelivery: Mission = {
  id: 'parcel-redelivery',
  version: 1,
  title: 'Parcel Re-delivery',
  district: 'digi-district',
  scene: 'void-deck',
  bands: ['teen', 'junior', 'young-adult'],
  theme: 'Phishing: fake delivery text',
  premise: 'Sara is waiting for her new headphones. A text says the parcel could not be delivered, and she must pay a S$1.80 fee through a link.',
  skillFocus: ['S', 'H'],
  timeOfDay: 'afternoon',
  scaffold: 'light',
  resident: 'sara',
  cast: [
    { id: 'sara', name: 'Sara', role: 'resident', anchor: 'phone-kiosk', pose: 'phone', look: { body: '#fb7185', accent: '#881337', hair: 'hijab' } },
    { id: 'mei', name: 'Mei', role: 'friend', anchor: 'stone-table', pose: 'sit', look: { body: '#5eead4', accent: '#134e4a', hair: 'long' } },
    { id: 'fakepost', name: 'LumenPost (SMS)', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'dad', name: "Sara's dad", role: 'trusted', anchor: 'lift-lobby', pose: 'walk', look: { body: '#93c5fd', accent: '#1e3a8a', hair: 'short' } },
  ],
  intro: 'Block 7 void deck, 4.15pm. Sara is at the phone kiosk getting a new screen protector. Her new headphones are due today. Mei waits at the stone table.',
  live: {
    durationSec: 50,
    decisionPrompt: 'The page wants the code. What should Sara do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: "Sara's phone buzzes. A text. The sender name says LumenPost." },
      { id: 'b2', at: 4, from: 'fakepost', channel: 'notification', text: 'Your parcel could not be delivered. Pay a S$1.80 fee within 24h, or it goes back.', tactic: 'urgency', attachment: { kind: 'link', label: 'lumenpost-redeliver.test', detail: 'Tap to pay and pick a new time' } },
      { id: 'b3', at: 9, from: 'sara', channel: 'speech', text: 'My headphones! They were meant to come today.' },
      { id: 'b4', at: 14, from: 'narrator', channel: 'scene', text: "The link opens a page with LumenPost's logo and colours. The address says lumenpost-redeliver.test.", tactic: 'authority' },
      { id: 'b5', at: 19, from: 'mei', channel: 'speech', text: "Just pay it. It's only S$1.80.", tactic: 'small-ask' },
      { id: 'b6', at: 24, from: 'fakepost', channel: 'notification', text: 'Enter your card number, expiry date and CVV to pay S$1.80.', attachment: { kind: 'payment', label: 'Pay S$1.80', detail: 'Card number · Expiry · CVV' } },
      { id: 'b7', at: 29, from: 'narrator', channel: 'scene', text: 'Sara opens the real LumenPost app. It says: "Out for delivery today."' },
      { id: 'b8', at: 34, from: 'fakepost', channel: 'notification', text: 'Last step! Type the 6-digit OTP we sent you to check the payment.', tactic: 'urgency', attachment: { kind: 'code', label: 'Harbour Bank: OTP to add your card to a mobile wallet', detail: 'Never share this OTP with anyone.' } },
      { id: 'b9', at: 40, from: 'fakepost', channel: 'notification', text: 'Problem? Call our hotline 8XXX XXXX.', tactic: 'authority' },
      { id: 'b10', at: 46, from: 'mei', channel: 'speech', text: 'Hurry, the page will time out!', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-sender', label: 'The sender name says "LumenPost"', target: { kind: 'beat', beatId: 'b1' }, redFlag: true, tactic: 'authority', explain: 'The name at the top is easy to make look official. On its own, a sender name proves nothing. Check in the official app.' },
    { id: 'c-urgent', label: 'Pay within 24 hours or the parcel goes back', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'urgency', explain: 'The time limit is there to make Sara rush. A real delivery company lets you sort things out in its own app.' },
    { id: 'c-domain', label: 'The address is lumenpost-redeliver.test', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'authority', explain: "LumenPost's real site is lumenpost.example. This one adds \"-redeliver\" and lives somewhere else. Logos are easy to copy. Addresses are harder to fake." },
    { id: 'c-card', label: 'Full card details for a S$1.80 fee', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'small-ask', explain: 'The tiny fee is the hook. What they really want is the card number, expiry date and CVV.' },
    { id: 'c-otp', label: 'The OTP is for adding the card to a mobile wallet', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, explain: 'Read the OTP text. It is not for S$1.80. It is for putting Sara\'s card into a phone wallet, on someone else\'s phone. An OTP is a key. Never share it.' },
    { id: 'c-number', label: 'A hotline number given inside the message', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'authority', explain: 'A number inside the message goes back to the same people. Use contact details you find yourself, like the official app.' },
    { id: 'c-same', label: "Up close on Mei's phone: the same LumenPost text, and she hasn't ordered anything", target: { kind: 'anchor', anchor: 'stone-table' }, redFlag: true, explain: 'The same text went to someone with no parcel at all. It was sent to lots of phones, hoping some people are waiting for a parcel.' },
    { id: 'c-app', label: 'The real LumenPost app: "Out for delivery today"', target: { kind: 'beat', beatId: 'b7' }, redFlag: false, explain: "Not a warning sign. This is LumenPost's own app, the right place to check. And it says nothing about a fee." },
  ],
  influence: {
    from: 'fakepost',
    hidden: { label: 'A card-stealing crew', description: 'They send the same text to thousands of phones. Card details plus the OTP let them add a card to their own phone wallet and spend with it.' },
    question: 'The text says it is from LumenPost. Pull the thread: who really gets Sara\'s card details?',
    options: [
      { id: 'i-post', text: 'LumenPost, so it can deliver the parcel.', correct: false, explain: "LumenPost's real app shows no fee at all. LumenPost isn't behind this." },
      { id: 'i-mei', text: 'Mei, because she told Sara to pay.', correct: false, explain: 'Mei got the same text. She is a target too, not the one behind it.' },
      { id: 'i-crew', text: "Scammers who will add Sara's card to their own phone wallet.", correct: true, explain: 'Right. The OTP was for adding her card to a wallet on their phone. Then they can spend with it.' },
    ],
  },
  forecast: {
    question: 'If Sara pays and types the OTP, what is most likely to happen by tonight?',
    horizon: 'tonight',
    options: [
      { id: 'f-parcel', text: "The headphones arrive, and that's it.", likely: false },
      { id: 'f-charges', text: 'Charges Sara never made show up on her card.', likely: true },
      { id: 'f-refund', text: 'LumenPost sends back the S$1.80.', likely: false },
    ],
    explain: 'With her card details and the OTP, scammers can set up her card on their own phone and start spending.',
  },
  choices: [
    {
      id: 'pay-link',
      label: 'Pay through the link and type the OTP',
      safety: 'risky',
      outcome: {
        title: 'Payment successful',
        text: '"Thank you! Your parcel will be re-delivered tomorrow." Sara breathes out. Problem solved, for S$1.80.',
        mood: 'shiny',
        effects: { risk: 2 },
      },
      feedback: {
        tactic: 'authority',
        saferMove: "to skip the link and check the parcel in LumenPost's own app, or on a site you type in yourself",
        ifItHappened: 'call your bank right away on the number on your card, tell a trusted adult, and make a police report.',
      },
      aftershock: {
        id: 'card-misused',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: 'THAT NIGHT',
        title: 'Charges Sara never made',
        text: "11pm. Sara's banking app shows S$240 spent at shops she has never been to. Her card was added to a mobile wallet on someone else's phone. That is what the OTP was for. The real headphones came at 6pm, with no fee.",
        effects: { wallet: -240, trust: -2, risk: 1 },
        fact: {
          text: 'Phishing scams: 6,264 cases in Singapore in 2025, mostly people giving away card details and OTPs. In the first half of 2026, courier-themed phishing led to cards being added to mobile wallets.',
          source: 'SPF, Annual Scam and Cybercrime Brief 2025 (25 Feb 2026); Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Sara feels sick. What should she do now?',
          options: [
            { id: 'r-bank', text: 'Call Harbour Bank now on the number on her card, tell her dad, and make a police report.', good: true, response: 'That is the best move. Calling the bank fast can stop more charges, and a report helps. Beacon lights up.', help: ['bank', 'trusted-adult', 'police-hotline', 'scamshield-1799'] },
            { id: 'r-wait', text: 'Wait and see if the charges stop.', good: false, response: 'Hoping it stops is natural. But waiting gives the scammers more time to spend. Telling her dad and calling the bank now is still the right step.' },
            { id: 'r-text', text: 'Call the "LumenPost" hotline to ask for a refund.', good: false, response: 'That number belongs to the same people, and they will ask for more codes. Call the bank on the number on the card instead, and tell an adult.' },
          ],
        },
      },
    },
    {
      id: 'call-number',
      label: 'Call the hotline number in the message',
      safety: 'unsure',
      outcome: {
        title: 'A friendly "agent"',
        text: 'A calm voice answers: "LumenPost, how can I help?" She says the fee is stuck, and asks Sara to read out the OTP "to release the parcel".',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'authority',
        saferMove: 'to use contact details you find yourself, like the official app, never a number inside the message',
        ifItHappened: 'hang up, never read out a code, and call the ScamShield Helpline 1799 to check.',
      },
    },
    {
      id: 'check-app',
      label: "Don't tap. Check the real app, then report the text",
      safety: 'safe',
      outcome: {
        title: 'No fee, no problem',
        text: 'The real LumenPost app says: "Out for delivery today. No fees due." Sara reports the text in the ScamShield app, deletes it, and shows Mei and her dad as he comes out of the lift. At 6pm, her headphones arrive.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to pause, skip the link, and check in the official app or on a site you type in yourself',
        ifItHappened: 'call your bank on the number on your card straight away and tell a trusted adult. Fast action helps.',
      },
      aftershock: {
        id: 'afterglow-sender',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'NEXT WEEK',
        title: 'Afterglow: the fake sender is flagged',
        text: "Sara's report, along with many others, helps get the fake sender flagged. Mei's grandma got the same text. Mei told her not to tap it.",
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'check-app', text: "Check the parcel where you know it's real: the official app. Never through a link in a text." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'check-app', text: "The address is not LumenPost's, and the OTP text says it is for a phone wallet, not a fee." },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'call-number', text: 'Sara really wants her headphones. Calling a real person feels safer than a link. At least she can ask questions.' },
  ],
  peerShield: {
    friend: 'mei',
    timeLabel: 'TWO DAYS LATER',
    setup: 'Mei gets a text: "LumenPost: customs fee S$2.50 unpaid. Pay today or your parcel will be destroyed." This time she did order a phone case. Her thumb is over the link.',
    messages: [
      { from: 'mei', text: 'eh I got one from LumenPost too' },
      { from: 'mei', text: 'customs fee S$2.50 or they destroy my parcel' },
      { from: 'mei', text: "it's only S$2.50 right? paying now" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-see', text: 'Wait! Can I see it first?', quality: 'great', why: 'A calm pause, without judging, keeps her talking to you.', guard: -15, doubt: 10 },
        { id: 'o-hmm', text: "Hmm, I don't know.", quality: 'ok', why: "Not unkind, but it doesn't help her stop.", guard: -5, doubt: 5 },
        { id: 'o-obvious', text: "Seriously? That's so obvious.", quality: 'harmful', why: 'Making her feel silly makes her defensive, and more likely to tap to prove a point.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-bait', text: 'The fee is tiny on purpose. They want your card details and the OTP, not S$2.50.', quality: 'great', why: 'Explains the trick and blames the scammers, not Mei.', guard: -5, doubt: 25 },
        { id: 'r-weird', text: 'That link looks a bit weird.', quality: 'ok', why: 'True, but she needs to know why it matters.', guard: 0, doubt: 10 },
        { id: 'r-small', text: "It's only S$2.50. What's the worst that can happen?", quality: 'harmful', why: 'The fee is not the danger. This tells her to stop checking.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-app', text: "Let's check your parcel in the real LumenPost app together.", quality: 'great', why: 'Checking another way, together, makes the safe step easy.', guard: -10, doubt: 15 },
        { id: 'f-later', text: 'Maybe check later?', quality: 'ok', why: 'Better than paying, but the text is still there with its timer.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "Pay first. Don't tell your parents.", quality: 'harmful', why: 'Secrets keep away the people who could help.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-1799', text: "If you're still not sure, ask your mum or call the ScamShield Helpline 1799.", quality: 'great', why: 'A trusted adult and an official helpline can check it.', guard: -5, doubt: 15 },
        { id: 'c-search', text: "Search online if it's a scam.", quality: 'ok', why: 'Searching can help, but the official app is faster and safer.', guard: 0, doubt: 5 },
        { id: 'c-number', text: 'Call the number in the text to ask.', quality: 'harmful', why: 'A decoy: that number belongs to the people who sent the text.', guard: 0, doubt: -10 },
      ],
    },
    outcomes: {
      success: 'Mei opens the real app: "Arriving Thursday. No fees due." "ok... deleting it. thanks for checking with me."',
      partial: 'Mei: "ok, not yet." She hasn\'t decided. A quick look at the real app would settle it.',
      fail: 'Mei: "whatever, it\'s only S$2.50." Seen.',
    },
  },
  ifThen: {
    if: 'a text asks me to pay a small fee or type a code through a link',
    then: 'skip the link, check the official app myself, and ask someone I trust',
  },
  help: ['trusted-adult', 'scamshield-1799', 'scamshield-report', 'bank', 'police-hotline', 'tinkle-friend'],
  sources: [
    { label: 'Annual Scam and Cybercrime Brief 2025 (25 Feb 2026): phishing cases', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026): courier-themed phishing and mobile wallets', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Advisory: never share OTPs; call your bank immediately and make a police report (12 Mar 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'gov.sg SMS Sender ID (Jul 2024): a sender name alone is not proof', publisher: 'gov.sg', asOf: '2026-10-08' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
