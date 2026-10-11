import type { Mission } from '../../mission';

// Solo tutorial (GAME_DESIGN.md §9.4 "The Free Bubble Tea Poster"), all bands, about 2 minutes.
// Harmless everyday stakes: a QR poster plus a friend's hurry. It teaches HOLD, spotting (one quiet
// clue that needs the scene) and one clear safe exit, and ends on a light joke. The one-time-code ask
// borrows PS2 "The Code Your Friend Needs", whose best lines also shape the Peer Shield.

export const firstHold: Mission = {
  id: 'first-hold',
  version: 1,
  title: 'The Free Bubble Tea Poster',
  district: 'digi-district',
  scene: 'void-deck',
  bands: ['junior', 'teen', 'young-adult'],
  theme: 'Tutorial: pause before you share or send a code',
  premise: 'A poster promises Mika a free bubble tea for sharing a link with 10 friends in 60 seconds. Then it asks for a code.',
  skillFocus: ['S', 'H', 'L'],
  timeOfDay: 'afternoon',
  scaffold: 'guided',
  resident: 'mika',
  cast: [
    { id: 'mika', name: 'Mika', role: 'resident', anchor: 'bench', pose: 'phone', look: { body: '#38bdf8', accent: '#0c4a6e', hair: 'long' } },
    { id: 'zara', name: 'Zara', role: 'friend', anchor: 'stone-table', pose: 'phone', look: { body: '#f472b6', accent: '#831843', hair: 'bun' } },
    { id: 'freeboba', name: 'Free Boba page', role: 'stranger', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'mum', name: "Mika's mum", role: 'trusted', anchor: 'lift-lobby', pose: 'walk', look: { body: '#a3e635', accent: '#365314', hair: 'hijab' } },
  ],
  intro: 'Block 12 void deck, after school. Mika and Zara are waiting for the rain to stop. A bright new poster is on the notice board.',
  live: {
    durationSec: 30,
    decisionPrompt: 'The page wants the code. Zara says hurry. What should Mika do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'The poster says FREE BUBBLE TEA in big letters. There is a QR code in the middle.' },
      { id: 'b2', at: 5, from: 'zara', channel: 'speech', text: 'Mika, look! Free bubble tea! Scan it, quick!', tactic: 'too-good' },
      { id: 'b3', at: 10, from: 'freeboba', channel: 'notification', text: 'Share this page with 10 friends in 60 seconds to win your free drink!', tactic: 'urgency', attachment: { kind: 'link', label: 'bobaboleh-free.test', detail: 'Timer: 60 seconds' } },
      { id: 'b4', at: 15, from: 'zara', channel: 'speech', text: 'Everyone in our class shared it already. Just do it!', tactic: 'everyone-does-it' },
      { id: 'b5', at: 20, from: 'freeboba', channel: 'notification', text: 'Last step! Type the 6-digit code we just sent to your ChatLah.', tactic: 'small-ask', attachment: { kind: 'code', label: 'ChatLah: your login code is 301957', detail: 'Never share this code with anyone. ChatLah will never ask you for it.' } },
      { id: 'b6', at: 25, from: 'zara', channel: 'speech', text: 'Hurry! The timer is almost done!', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-free', label: 'A free drink for a few taps', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Shops do give free drinks sometimes. But a prize that needs you to rush and share is a hook, not a gift.' },
    { id: 'c-share', label: 'Share with 10 friends in 60 seconds', target: { kind: 'beat', beatId: 'b3' }, redFlag: true, tactic: 'urgency', explain: 'The timer stops Mika from checking. Sharing also sends the same trick to 10 more people.' },
    { id: 'c-everyone', label: '"Everyone shared it already"', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'everyone-does-it', explain: 'Lots of people sharing a link does not make it safe. It only means the trick is spreading.' },
    { id: 'c-code', label: 'A drink page asking for a ChatLah login code', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, tactic: 'small-ask', explain: 'A login code is a key to Mika\'s account. The code message itself says never share it. A drink never needs a password.' },
    { id: 'c-sticker', label: 'Up close: the QR code is a sticker stuck over the printed one', target: { kind: 'anchor', anchor: 'notice-board' }, redFlag: true, explain: 'Someone pasted their own code on top of the poster. A sticker code can send you anywhere. You only see it if you look closely.' },
    { id: 'c-flyer', label: 'A Boba Boleh flyer: "Buy 1 get 1 free, Fridays, in our shop"', target: { kind: 'anchor', anchor: 'letterboxes' }, redFlag: false, explain: 'This is a normal shop deal. It asks for nothing except buying a drink at the counter. Not every offer is a trick.' },
  ],
  influence: {
    from: 'zara',
    hidden: { label: 'Whoever made the fake page', description: 'They collect ChatLah accounts. Every share brings them 10 more people to try.' },
    question: 'Zara is rushing Mika. Who really gains if Mika shares the link and types the code?',
    options: [
      { id: 'i-zara', text: 'Zara. She gets a free drink.', correct: false, explain: 'Zara thinks so, but nobody gets a drink. She is being used to spread the link.' },
      { id: 'i-shop', text: 'Boba Boleh, the bubble tea shop.', correct: false, explain: 'The real shop is not running this. Someone stuck their own code over the poster.' },
      { id: 'i-page', text: 'The people behind the fake page. They get Mika\'s account and 10 more people to trick.', correct: true, explain: 'Right. The code unlocks Mika\'s ChatLah, and the shares bring them new targets.' },
    ],
  },
  forecast: {
    question: 'If Mika shares the link and types the code, what is most likely to happen tonight?',
    horizon: 'tonight',
    options: [
      { id: 'f-drink', text: 'Mika gets a free bubble tea.', likely: false },
      { id: 'f-account', text: "Mika's ChatLah starts sending the poster to friends without Mika.", likely: true },
      { id: 'f-nothing', text: 'Nothing happens at all.', likely: false },
    ],
    explain: 'The code was the key to Mika\'s ChatLah. With it, someone else can log in and message all of Mika\'s friends.',
  },
  choices: [
    {
      id: 'share-code',
      label: 'Share the link and type the code',
      safety: 'risky',
      outcome: {
        title: 'Timer beaten!',
        text: 'Confetti fills the screen: "You win! Show this at any Boba Boleh." Zara cheers. For a moment it feels like a win.',
        mood: 'shiny',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to pause, never type a login code into a page, and ask a trusted adult first',
        ifItHappened: 'tell a trusted adult. Together, use ChatLah\'s own app to log out other devices and change the password, then warn friends not to open the link.',
      },
      aftershock: {
        id: 'account-taken',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: 'THAT NIGHT',
        title: "Mika's ChatLah is sending messages by itself",
        text: 'Friends ask why Mika sent them the free bubble tea link. Mika can\'t log in any more. And at the shop, the "You win!" screen got a puzzled look.',
        effects: { trust: -1, risk: 1 },
        fact: {
          text: 'Police advise: never share one-time codes, even with friends. Remove devices you don\'t know from your account and turn on two-step checks.',
          source: 'SPF advisory on the compromise of messaging accounts, 12 Mar 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'It already happened. What should Mika do now?',
          options: [
            { id: 'r-adult', text: 'Tell Mum, use ChatLah\'s own help page together to get the account back, and warn friends.', good: true, response: 'That is the best move. Mum helps Mika get the account back, and the warning stops friends from opening the link. Beacon lights up.', help: ['trusted-adult', 'scamshield-1799'] },
            { id: 'r-new', text: 'Make a new account and say nothing.', good: false, response: 'Wanting it to just go away is normal. But friends are still getting the link from the old account. Telling an adult is still the next step, and it is not too late.' },
            { id: 'r-page', text: 'Message the page and ask for the account back.', good: false, response: 'The page belongs to the people who took the account, so they won\'t help. Tell a trusted adult and use ChatLah\'s own help page instead.' },
          ],
        },
      },
    },
    {
      id: 'share-only',
      label: 'Share the link, but skip the code',
      safety: 'unsure',
      outcome: {
        title: '"One more step!"',
        text: 'The page keeps asking for the code, and no drink comes. Ten friends now have the link too. Two of them ask Mika, "Is this real?"',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to pause before you forward anything, and check with a trusted adult if a deal looks too easy',
        ifItHappened: 'send friends a quick "don\'t open that link, it\'s fake", and tell a trusted adult.',
      },
    },
    {
      id: 'hold-tell',
      label: "Don't scan or share. Show the poster to Mum.",
      safety: 'safe',
      outcome: {
        title: 'Bubble tea does not need a password',
        text: 'Mum reads the poster and laughs. "A drink that needs your ChatLah code? Bubble tea doesn\'t need a password." She tells the shop about the sticker, then buys two cups anyway. No codes needed.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'urgency',
        saferMove: 'to pause, check with someone you trust, and never share a login code',
        ifItHappened: 'tell a trusted adult straight away. Getting help early makes it easier to fix.',
      },
      aftershock: {
        id: 'afterglow-poster',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'NEXT DAY',
        title: 'Afterglow: the sticker comes down',
        text: 'The fake sticker is gone. Boba Boleh puts up a sign: "We never ask for codes." Zara tells the class chat not to scan the old one.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'hold-tell', text: 'A real deal can wait one minute. When a page wants a code, that is the moment to stop.' },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'hold-tell', text: 'The QR code is a sticker on top of the poster, and the code message says never share it.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'share-only', text: 'Zara really wants this, and sharing feels harmless. Maybe share it but skip the code, so she isn\'t let down?' },
  ],
  peerShield: {
    friend: 'zara',
    timeLabel: 'THE NEXT DAY',
    setup: 'Zara gets a ChatLah message from her cousin\'s account: "I sent my code to your number by mistake. Can you send me the 6 digits?" Her thumb is over Send.',
    messages: [
      { from: 'zara', text: 'my cousin says she sent her code to me by accident' },
      { from: 'zara', text: 'she needs the 6 numbers back fast. should I just send?' },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-see', text: 'Wait! Can I see that first?', quality: 'great', why: 'A calm pause, without judging, keeps her talking to you.', guard: -15, doubt: 10 },
        { id: 'o-hmm', text: "Hmm, I don't know.", quality: 'ok', why: 'Not unkind, but it doesn\'t help her stop.', guard: -5, doubt: 5 },
        { id: 'o-knows', text: 'Seriously? Everyone knows that\'s a scam.', quality: 'harmful', why: 'Making her feel silly makes her defensive, and more likely to send it to prove a point.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-key', text: "That code is a key to her account. Her account might be hacked, so it may not be her.", quality: 'great', why: 'Explains what the code does and blames the hacker, not anyone in the chat.', guard: -5, doubt: 25 },
        { id: 'r-private', text: 'Codes are kind of private.', quality: 'ok', why: 'True, but vague. She needs to know why.', guard: 0, doubt: 10 },
        { id: 'r-family', text: "She's family, it's probably fine.", quality: 'harmful', why: 'A familiar name is exactly what this trick borrows.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-call', text: "Let's call her to check. Not chat. Call.", quality: 'great', why: 'Checking another way works, because whoever took the account controls the chat.', guard: -10, doubt: 15 },
        { id: 'f-later', text: 'Maybe ask her later?', quality: 'ok', why: 'Waiting is better than sending, but it leaves the question open.', guard: -5, doubt: 5 },
        { id: 'f-hide', text: "Send it, but don't tell your mum.", quality: 'harmful', why: 'Secrets keep away the people who could help.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-adult', text: 'If it still feels weird, we tell your mum or our teacher.', quality: 'great', why: 'A trusted adult can help check and fix things.', guard: -5, doubt: 15 },
        { id: 'c-online', text: 'Search online if it\'s a scam.', quality: 'ok', why: 'Searching can help, but a trusted adult is faster and safer.', guard: 0, doubt: 5 },
        { id: 'c-reply', text: 'Reply in the chat and ask if it\'s really her.', quality: 'harmful', why: 'Whoever took the account controls that chat, so they will just say yes.', guard: 0, doubt: -10 },
      ],
    },
    outcomes: {
      success: 'Zara calls her cousin. "What code? I never sent you anything!" Her cousin\'s account was hacked. A parent helps her get it back, and Zara warns the class.',
      partial: 'Zara: "ok, I won\'t send it yet." She is not sure what to do next. A quick call to her cousin would settle it.',
      fail: 'Zara: "whatever, I\'ll just send it." Seen.',
    },
  },
  ifThen: {
    if: 'a page or a person rushes me to share something or send a code',
    then: 'pause, keep the code to myself, and ask a trusted adult',
  },
  help: ['trusted-adult', 'scamshield-1799', 'tinkle-friend', 'mindline-1771'],
  sources: [
    { label: 'Advisory on the compromise of WhatsApp accounts (never share OTPs; remove unknown linked devices; turn on two-step verification), 12 Mar 2026', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'I can ACT against scams: Add, Check, Tell', publisher: 'ScamShield (scamshield.gov.sg)', asOf: '2026-10-08', url: 'https://www.scamshield.gov.sg' },
    { label: 'Stop and Check campaign', publisher: 'Cyber Security Agency of Singapore', asOf: '2026-10-08' },
    { label: 'Tinkle Friend and mindline 1771 (partner list)', publisher: 'Online Safety Commission, Get support from our partners', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
