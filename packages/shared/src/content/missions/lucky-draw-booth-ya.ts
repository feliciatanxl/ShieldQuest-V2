import type { Mission } from '../../mission';

// M07 The Lucky Draw Booth, 17-24 variant (GAME_DESIGN.md §9.2). Same deep structure as lucky-draw-booth (a prize
// traded for far more data than a draw needs), but the booth wants identity documents: an IC number and a selfie
// holding the IC "to verify you're 18". Band dials (§5.4): four exits including a "check first" stall, two decoys
// including conflicting evidence (real mall lucky draws do exist), and consequences that are social and financial.
// Players only inspect the form's fields (beat b4); nothing is ever typed. 'data-leaked' is the GDD's `dataLeaked`
// flag, as in the junior/teen mission.

export const luckyDrawBoothYa: Mission = {
  id: 'lucky-draw-booth-ya',
  version: 1,
  title: 'The Lucky Draw Booth',
  district: 'retail-district',
  scene: 'minimart',
  bands: ['young-adult'],
  theme: 'Identity data requests',
  premise:
    'A mall booth gives S$10 LumenPay credit and a shot at a Lumen Tab Pro for a one-minute sign-up. The form wants Jun Hao\'s IC number, address and a selfie holding his IC.',
  skillFocus: ['S', 'E'],
  timeOfDay: 'evening',
  scaffold: 'light',
  resident: 'junhao',
  cast: [
    { id: 'junhao', name: 'Jun Hao', role: 'resident', anchor: 'atrium-booth', pose: 'phone', look: { body: '#38bdf8', accent: '#0c4a6e', hair: 'short' } },
    { id: 'promoter', name: 'Booth promoter', role: 'stranger', anchor: 'atrium-booth', pose: 'stand', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'huimin', name: 'Hui Min', role: 'friend', anchor: 'phone-shop', pose: 'phone', look: { body: '#f472b6', accent: '#831843', hair: 'long' } },
  ],
  intro:
    'Lumen Mall, Friday, 7.25pm. Jun Hao, 19, is passing the time while his friend Hui Min picks a phone case. A booth in the atrium is giving out bubble tea, and the queue is moving fast.',
  live: {
    durationSec: 55,
    decisionPrompt: "The camera is counting down with Jun Hao's IC in the frame. What should he do?",
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'The booth\'s banner glows: "WIN A LUMEN TAB PRO. Every sign-up gets S$10 LumenPay credit + free bubble tea."' },
      { id: 'b2', at: 4, from: 'promoter', channel: 'speech', text: 'Bro, free S$10 credit, confirm. Plus the Lumen Tab Pro draw tonight!', tactic: 'too-good' },
      { id: 'b3', at: 9, from: 'promoter', channel: 'speech', text: 'Just scan this, one minute only.', attachment: { kind: 'code', label: 'QR standee', detail: 'Opens lumen-luckydraw.test' } },
      { id: 'b4', at: 14, from: 'narrator', channel: 'scene', text: 'The sign-up form loads on Jun Hao\'s phone.', attachment: { kind: 'link', label: 'lumen-luckydraw.test/signup', detail: 'Full name · Date of birth · IC number · Home address · Mobile number · Selfie holding your IC' } },
      { id: 'b5', at: 19, from: 'junhao', channel: 'speech', text: 'Why do you need my IC for a lucky draw?' },
      { id: 'b6', at: 23, from: 'promoter', channel: 'speech', text: "Standard procedure lah, to verify you're 18 and above. All the big brands do it.", tactic: 'authority' },
      { id: 'b7', at: 29, from: 'huimin', channel: 'speech', text: 'Eh, malls do real lucky draws what. I won a S$50 voucher last Chinese New Year.' },
      { id: 'b8', at: 34, from: 'promoter', channel: 'speech', text: "Don't worry, your data is 100% secure. We're an official partner.", tactic: 'fake-proof', attachment: { kind: 'image', label: 'Badge on the promoter\'s lanyard', detail: '"Official Event Partner", under a logo that looks a lot like the mall\'s' } },
      { id: 'b9', at: 40, from: 'promoter', channel: 'speech', text: "Only 20 sign-ups left for today's draw!", tactic: 'urgency' },
      { id: 'b10', at: 45, from: 'huimin', channel: 'speech', text: 'I signed up already. Quick, then we go eat.', tactic: 'everyone-does-it' },
      { id: 'b11', at: 50, from: 'promoter', channel: 'speech', text: 'Okay, hold your IC next to your face. Three, two...', tactic: 'small-ask' },
    ],
  },
  clues: [
    { id: 'c-prize', label: 'S$10 credit, bubble tea and a Lumen Tab Pro draw, for one minute', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'The giveaway is cheap. What it buys is worth far more: a full identity profile, collected in a minute.' },
    { id: 'c-link', label: "The QR opens lumen-luckydraw.test, not the mall's own site or app", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: 'A QR code is just a link someone printed. This one sends everything to a site with no connection to the mall.' },
    { id: 'c-fields', label: 'IC number, address, mobile and a selfie holding the IC', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, explain: 'A draw needs one way to reach the winner. A name, IC number, address and an IC selfie together are enough to pass as Jun Hao.' },
    { id: 'c-ic', label: '"Standard procedure" to check age with an IC selfie', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, tactic: 'authority', explain: 'A face next to an ID card is what is used to prove who you are. A lucky draw has no reason to collect it, and "all the big brands do it" is not a source.' },
    { id: 'c-badge', label: '"Official Event Partner" badge with a lookalike mall logo', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'fake-proof', explain: 'The booth printed its own badge. Logos are easy to copy, and "100% secure" is a claim from the people asking.' },
    { id: 'c-rush', label: '"Only 20 sign-ups left"', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, tactic: 'urgency', explain: "A countdown stops Jun Hao from walking twenty metres to the mall's customer service counter to check." },
    { id: 'c-terms', label: 'Up close: "T&Cs apply" in tiny print, but no terms and no organiser name anywhere', target: { kind: 'anchor', anchor: 'atrium-booth' }, redFlag: true, explain: 'Real lucky draws name who runs them and publish their terms. A booth with neither leaves nobody to hold to account.' },
    { id: 'c-real', label: 'Hui Min once won a real mall lucky draw', target: { kind: 'beat', beatId: 'b7' }, redFlag: false, explain: 'True: malls do run real lucky draws, and that is exactly why fake ones work. Real ones name the organiser, publish terms, and can be checked at the customer service counter.' },
    { id: 'c-kiosk', label: 'The mall\'s own screen by the door: "Rate your visit, 1 to 5 stars"', target: { kind: 'anchor', anchor: 'door' }, redFlag: false, explain: "Ordinary. The mall's own feedback screen asks for a star rating and nothing about you. Not every request for input is a trap." },
  ],
  influence: {
    from: 'promoter',
    hidden: {
      label: 'Whoever runs lumen-luckydraw.test',
      description:
        'The booth is a front for collecting identity details in bulk. A name, IC number, address and an IC selfie together can be used to impersonate someone, or passed on to make scam messages that sound real.',
    },
    question: 'Pull the thread from the promoter. Who gains most if Jun Hao completes the sign-up?',
    options: [
      { id: 'i-mall', text: 'The mall. It wants data on its shoppers.', correct: false, explain: "The mall's own screen asks for stars only, and the form never touches the mall's site. The thread runs elsewhere." },
      { id: 'i-site', text: 'Whoever runs lumen-luckydraw.test. They walk away with a ready-made identity kit.', correct: true, explain: 'Right. The S$10 is the cost of doing business. An IC number plus an IC selfie can be reused again and again.' },
      { id: 'i-promoter', text: 'The promoter. Each sign-up earns a commission, and that is all.', correct: false, explain: "The promoter may well be paid per sign-up, but the thread keeps going: the details go to the site's owners, who keep them." },
    ],
  },
  forecast: {
    question: 'If Jun Hao completes the sign-up, what is most likely within the next month or two?',
    horizon: 'next-month',
    options: [
      { id: 'f-win', text: 'He wins the Lumen Tab Pro.', likely: false },
      { id: 'f-impersonate', text: "Messages and fake profiles start using Jun Hao's name, details and face.", likely: true },
      { id: 'f-spam', text: 'A few marketing SMSes, nothing worse.', likely: false },
    ],
    explain: 'An IC number and an IC selfie are identity documents, not marketing data. Once they are out, they can be reused again and again, and they cannot be changed like a password.',
  },
  choices: [
    {
      id: 'fill-all',
      label: 'Fill it all in, IC selfie included',
      safety: 'risky',
      outcome: {
        title: '+S$10 credit',
        text: 'Jun Hao holds his IC next to his face, the camera clicks, and S$10 LumenPay credit lands a minute later. "Good luck tonight!" It really did take one minute.',
        mood: 'shiny',
        effects: { wallet: 10 },
      },
      feedback: {
        tactic: 'authority',
        saferMove: "to never hand over an IC number or an IC selfie for a prize, and to check any promotion at the venue's own customer service counter",
        ifItHappened: 'warn your contacts, treat any message that uses your details as suspect, report it in the ScamShield app, and make a police report if your identity is misused.',
      },
      aftershock: {
        id: 'data-leaked',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '6 WEEKS LATER',
        title: "Jun Hao's details are being used",
        text: 'A classmate messages: "Bro, is this your new ChatLah account? It\'s asking me to lend it S$300." The profile uses his booth selfie. The same week, an SMS arrives with his full name and IC number: "Harbour Bank: confirm your new card at harbour-verify.test." Nobody won a Lumen Tab Pro that night.',
        effects: { trust: -2, risk: 2 },
        fact: {
          text: 'ScamShield\'s advice: "Check for scam signs and with official sources." That means the bank\'s own app or the number on your card, never a link in the message.',
          source: 'ScamShield, I can ACT against scams (updated 23 Jul 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'His details are out, and someone is using them. What now?',
          options: [
            { id: 'r-act', text: 'Warn his contacts, report the fake profile on ChatLah, report the SMS in the ScamShield app, and make a police report about the misuse of his identity.', good: true, response: "That's the strongest move. Warning contacts quickly stops the fake profile from working, and a police report puts on record that someone else is using his identity. Beacon lights up.", help: ['scamshield-report', 'police-hotline', 'trusted-adult'] },
            { id: 'r-link', text: 'Tap the Harbour Bank link to check that his account is okay.', good: false, response: "Wanting to check is the right instinct, but that link belongs to the same people. Open Harbour Bank's own app or call the number on his card, then tell someone he trusts." },
            { id: 'r-ignore', text: 'Ignore it. He has not lost any money.', good: false, response: "It's understandable to want to move on. But his details are still being used on the people he knows. Warning them and reporting it now is still the next step." },
          ],
        },
      },
    },
    {
      id: 'fill-basic',
      label: 'Enter with just his name and mobile number, skip the IC and selfie',
      safety: 'unsure',
      outcome: {
        title: 'Entry "pending"',
        text: 'The promoter frowns. "Without IC cannot claim the prize, but I keep your entry first." No credit, no bubble tea. His name and number are on their list anyway.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to give nothing to an organiser you cannot identify. A name plus a mobile number is enough to start targeted messages',
        ifItHappened: 'treat any "you won" message as a scam, don\'t tap its links, and report it in the ScamShield app.',
      },
    },
    {
      id: 'ask-terms',
      label: 'Ask who runs the draw and to see the terms first',
      safety: 'unsure',
      outcome: {
        title: 'A card with another QR',
        text: 'The promoter hands over a glossy card: "All the terms are here." The QR opens lumen-luckydraw.test/terms, on the same site, written by the same people. Asking was smart. The answer just cannot be checked.',
        mood: 'sober',
        effects: {},
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: "to check the organiser through the venue itself, like the mall's customer service counter, not through anything the booth hands you",
        ifItHappened: 'if you have already entered, watch for messages that use your details and report them in the ScamShield app.',
      },
    },
    {
      id: 'walk-check',
      label: "Skip it, ask at the mall's customer service counter, and report the site",
      safety: 'safe',
      outcome: {
        title: 'Not on the list',
        text: '"No lucky draw is registered with us today," the customer service officer says, and calls mall security to speak to the booth. Jun Hao reports lumen-luckydraw.test in the ScamShield app. Hui Min goes quiet: she signed up ten minutes ago.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: "to walk away and check any promotion with the venue's own counter, website or app",
        ifItHappened: 'tell someone you trust, watch for messages that use your details, and report them in the ScamShield app.',
      },
      aftershock: {
        id: 'afterglow-booth-gone',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: the booth is gone',
        text: 'The booth has been packed away, and a mall notice now says: "Our lucky draws are run only at Customer Service." When a "you won!" message lands in Jun Hao\'s class chat, two people check with him before tapping anything.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'walk-check', text: 'Everything that says this is legit came from the booth: the badge, the "standard procedure", the terms link. The mall\'s own counter is twenty metres away.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'ask-terms', text: "Hui Min is right that real lucky draws exist. Asking for the terms is fair. Jun Hao isn't accusing anyone, just checking." },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'walk-check', text: 'An IC selfie is identity, not marketing data. No prize is worth handing that to someone with no name.' },
  ],
  peerShield: {
    friend: 'huimin',
    timeLabel: 'THAT NIGHT',
    setup: 'Near midnight, Hui Min messages Jun Hao. She gave the booth everything, IC selfie included, and now a "Lumen Lucky Draw" account says she has won.',
    messages: [
      { from: 'huimin', text: 'eh I WON the lumen tab pro?? they just texted me' },
      { from: 'huimin', text: 'need to pay S$30 processing fee and confirm my details by midnight' },
      { from: 'huimin', text: "don't tell the others yet ok, I want to surprise them 😆" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-thanks', text: 'Wah, okay. Thanks for telling me first.', quality: 'great', why: 'Thanking her for sharing keeps her talking instead of getting defensive.', guard: -20, doubt: 5 },
        { id: 'o-send', text: 'Hmm, send me the message?', quality: 'ok', why: 'Practical, but it does not make her feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-ic', text: 'Seriously? You gave them your IC?', quality: 'harmful', why: 'Shame makes people defend their choice instead of rethinking it.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-fee', text: "Real draws don't charge a fee to claim. They already have your details, so this \"win\" is how they get your money too.", quality: 'great', why: 'A clear, checkable reason that blames the scheme, not her.', guard: -5, doubt: 25 },
        { id: 'r-off', text: 'Sounds a bit off.', quality: 'ok', why: 'True, but vague. She needs a reason.', guard: 0, doubt: 10 },
        { id: 'r-pay', text: 'Just pay the S$30, worst case you lose S$30.', quality: 'harmful', why: 'Paying hands over card details too, and "processing fees" tend to keep coming.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-counter', text: "Let's ask at the mall's customer service counter tomorrow if anyone won anything. I'll come with you.", quality: 'great', why: 'A concrete plan with company, and a real way to check.', guard: -10, doubt: 15 },
        { id: 'f-online', text: 'You could check online.', quality: 'ok', why: 'Searching can lead to more fake pages. An official channel is safer.', guard: -5, doubt: 5 },
        { id: 'f-quiet', text: "Okay, I won't say anything to anyone.", quality: 'harmful', why: 'Keeping it quiet helps the scheme. Her family needs to know her details are out.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-official', text: "Don't pay. Report the message in the ScamShield app, or call 1799 to check. If you shared card details, call your bank on the number on the card.", quality: 'great', why: 'Points to official channels that can actually help.', guard: -5, doubt: 15 },
        { id: 'c-block', text: 'Just block them.', quality: 'ok', why: 'Blocking helps, but her details are still out there and nobody has been warned.', guard: 0, doubt: 0 },
        { id: 'c-prove', text: "Reply and ask them to prove it's real.", quality: 'harmful', why: 'They control every "proof" they send. Replying also tells them she is engaged.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Hui Min: "ok wait. ya... no prize needs a fee. not paying. can you come with me tmr?" She reports the message and tells her family her details are out.',
      partial: 'Hui Min: "hmm ok I\'ll think about it. the deadline is midnight though." Checking in again before midnight could help.',
      fail: 'Hui Min: "wah ok, forget it. I\'ll settle it myself." Seen.',
    },
  },
  ifThen: {
    if: 'a promotion asks for my IC number, an IC selfie or my bank details',
    then: "walk away, check with the venue's own counter or app, and report it in the ScamShield app",
  },
  help: ['scamshield-1799', 'scamshield-report', 'police-hotline', 'bank', 'trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'I can ACT against scams ("Check for scam signs and with official sources"), updated 23 Jul 2026', publisher: 'ScamShield', asOf: '2026-10-08', url: 'https://www.scamshield.gov.sg' },
    { label: 'ScamShield Helpline 1799 and Police Hotline 1800 255 0000', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
    { label: 'Lodge Police Report e-service', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Get support from our partners (mindline 1771)', publisher: 'Online Safety Commission', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
