import type { Mission } from '../../mission';

// M10 Behind the Stall (GAME_DESIGN.md §9.2): a pre-order collectible scam in Digi Sky's Barang Market.
// 14-16 primary; the 10-13 card-pack pre-order shares the same premise, so it is the same mission written in plain
// words with three exits. Signature moment: orbit behind the glossy booth and find a cardboard facade on sticks,
// with every review lantern hung on the same day. The 17-24 lightstick-deposit variant is behind-the-stall-ya.ts.

export const behindTheStall: Mission = {
  id: 'behind-the-stall',
  version: 1,
  title: 'Behind the Stall',
  district: 'digi-district',
  scene: 'digi-sky',
  bands: ['teen', 'junior'],
  theme: 'Online shopping: pre-order scam',
  premise: 'Jun wants a sealed box of Metro Legends cards. A five-star shop has it at less than half price, as a pre-order. It just needs a deposit, paid outside the checkout.',
  skillFocus: ['S', 'E'],
  timeOfDay: 'evening',
  scaffold: 'light',
  resident: 'jun',
  cast: [
    { id: 'jun', name: 'Jun', role: 'resident', anchor: 'chatlah-plaza', pose: 'phone', look: { body: '#facc15', accent: '#713f12', hair: 'short' } },
    { id: 'theo', name: 'Theo', role: 'friend', anchor: 'arcade', pose: 'lean', look: { body: '#34d399', accent: '#064e3b', hair: 'cap' } },
    { id: 'vault', name: 'LegendVault', role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
  ],
  intro: 'Digi Sky, 8pm. Jun has wanted a sealed box of Metro Legends cards for months. He and Theo are browsing Barang Market when a shiny new booth lights up.',
  live: {
    durationSec: 48,
    decisionPrompt: 'The deposit button is glowing. What should Jun do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'A glowing booth: LegendVault. Five gold stars and a long string of review lanterns.' },
      { id: 'b2', at: 4, from: 'vault', channel: 'chat', text: 'Metro Legends sealed box, PRE-ORDER! Only S$50. Shops sell it for S$110.', tactic: 'too-good', attachment: { kind: 'listing', label: 'Metro Legends Booster Box (sealed) · PRE-ORDER', detail: 'S$50 · usual S$110 · 5.0 stars (212 reviews)' } },
      { id: 'b3', at: 8, from: 'theo', channel: 'speech', text: "Jun, that's less than half price! Half the card club is buying.", tactic: 'everyone-does-it' },
      { id: 'b4', at: 13, from: 'vault', channel: 'chat', text: 'Boxes ship in 3 months. Pre-order now before the price goes up!' },
      { id: 'b5', at: 18, from: 'narrator', channel: 'scene', text: 'The stall next door sells the same box for S$108. Its sign says: "Pay with Barang Checkout. Buyer protection."' },
      { id: 'b6', at: 23, from: 'vault', channel: 'chat', text: 'Barang checkout has fees. Pay me direct with MetroPay. Cheaper for you 😉' },
      { id: 'b7', at: 28, from: 'vault', channel: 'chat', text: 'Here are real photos 📸', attachment: { kind: 'image', label: 'box_photo_1.jpg', detail: 'A shiny sealed box on a white table' } },
      { id: 'b8', at: 33, from: 'vault', channel: 'chat', text: 'Pay a S$25 deposit by 10pm tonight. Only 3 boxes left!', tactic: 'urgency' },
      { id: 'b9', at: 38, from: 'vault', channel: 'chat', text: '212 five-star reviews. Very trusted seller, no worries 👍', tactic: 'fake-proof' },
      { id: 'b10', at: 43, from: 'theo', channel: 'speech', text: "Quick, before they're gone! I'm paying for mine too.", tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-price', label: 'Less than half the usual price', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'When a price is far below every other shop, ask why. A very low price is the bait that makes people rush.' },
    { id: 'c-months', label: 'The box ships in 3 months', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, explain: 'The seller gets the money now, and Jun cannot check anything for months. By then, the shop could be gone.' },
    { id: 'c-offplatform', label: 'Pay outside Barang\'s checkout', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: "Barang's checkout holds the money until the box arrives. That is buyer protection. Paying direct throws it away. \"No fees\" is the bait." },
    { id: 'c-deposit', label: 'Deposit by 10pm, only 3 left', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'urgency', explain: 'A countdown stops Jun from checking or asking anyone. A real seller can wait a day.' },
    { id: 'c-reviews', label: 'Every review lantern was hung on the same day', target: { kind: 'anchor', anchor: 'review-lanterns' }, redFlag: true, tactic: 'fake-proof', explain: 'Real shops collect reviews slowly, over months. 212 reviews in one day were most likely made by the seller.' },
    { id: 'c-facade', label: 'Behind the booth: a cardboard front on sticks, and a tag "Shop opened 6 days ago"', target: { kind: 'anchor', anchor: 'barang-booth' }, redFlag: true, explain: 'From the front it looks like a big shop. From behind, there is nothing there. A six-day-old shop with 212 reviews does not add up.' },
    { id: 'c-genuine', label: 'Next door: a seller using Barang Checkout', target: { kind: 'beat', beatId: 'b5' }, redFlag: false, explain: 'This is what a safer deal looks like: a normal price, and the platform\'s own checkout with buyer protection. Not every seller is a trick.' },
    { id: 'c-photos', label: 'Nice, clear photos of the box', target: { kind: 'beat', beatId: 'b7' }, redFlag: false, explain: 'Good photos are not a warning sign. But they are not proof either. Anyone can copy photos from the internet.' },
  ],
  influence: {
    from: 'vault',
    hidden: { label: 'A deposit collector', description: 'Someone who sets up a fake shopfront, collects deposits from many buyers, then vanishes before the "delivery date".' },
    question: 'The booth says LegendVault. Pull the thread: who is really behind it, and what do they want?',
    options: [
      { id: 'i-collector', text: 'A card collector clearing out spare boxes.', correct: false, explain: 'A collector would have the boxes now. This shop is cardboard at the back, and its reviews all came in one day.' },
      { id: 'i-barang', text: 'Barang Market, to make more sales.', correct: false, explain: 'Barang wants buyers to use its checkout. This seller wants Jun to leave it.' },
      { id: 'i-deposits', text: 'Someone collecting deposits from lots of buyers, who will vanish before the boxes are due.', correct: true, explain: 'Right. A three-month wait gives them plenty of time to collect money and disappear.' },
    ],
  },
  forecast: {
    question: 'If Jun pays the deposit, what is most likely to happen when the 3 months are up?',
    horizon: 'next-month',
    options: [
      { id: 'f-box', text: 'The box arrives, sealed and on time.', likely: false },
      { id: 'f-gone', text: 'The box never comes, the shop is gone, and so is the deposit.', likely: true },
      { id: 'f-refund', text: 'Barang Market pays Jun back straight away.', likely: false },
    ],
    explain: 'Money paid outside the checkout has no buyer protection. When the date passes, there is usually nobody left to ask.',
  },
  choices: [
    {
      id: 'pay-deposit',
      label: 'Pay the S$25 deposit with MetroPay',
      safety: 'risky',
      outcome: {
        title: 'Pre-order confirmed!',
        text: 'LegendVault sends a cute thank-you sticker and a tracking page: "Preparing your box". Theo cheers. Jun can\'t stop smiling.',
        mood: 'shiny',
        effects: { wallet: -25 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: "to pay only through Barang's own checkout with buyer protection, or to walk away",
        ifItHappened: 'tell a parent, keep the chats, report the shop to Barang Market, and contact MetroPay or the bank together.',
      },
      aftershock: {
        id: 'deposit-gone',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '3 MONTHS LATER',
        title: 'The delivery date comes and goes',
        text: 'The tracking page still says "Preparing". Then LegendVault vanishes from Barang Market. Jun\'s messages get one grey tick. The S$25 deposit is gone, and so are the deposits of everyone else who paid.',
        effects: { trust: -2, risk: 1 },
        fact: {
          text: 'E-commerce scams had the most cases of any scam type in Singapore in 2025 (6,703). In the first half of 2026, trading-card scams, driven by pre-orders, made up 605 cases.',
          source: 'SPF, Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Jun feels awful. What should he do now?',
          options: [
            { id: 'r-tell', text: 'Tell his dad, report the shop to Barang Market, and contact MetroPay together. Make a police report too.', good: true, response: 'That is the best move. Reporting fast can help stop the seller and warn other buyers. Beacon lights up.', help: ['trusted-adult', 'bank', 'scamshield-report', 'police-hotline'] },
            { id: 'r-wait', text: "Wait a bit longer. Maybe it's just late.", good: false, response: 'Hoping it is just late is natural. But every day of waiting helps the seller take more deposits. Telling his dad and reporting now can still help.' },
            { id: 'r-fee', text: 'Pay the "customs fee" that a new account says will release the box.', good: false, response: 'That message is the same trick asking for more. Don\'t pay. Telling a trusted adult and reporting is still the next step, and it is not too late.' },
          ],
        },
      },
    },
    {
      id: 'ask-video',
      label: 'Ask the seller for a video of the box first',
      safety: 'unsure',
      outcome: {
        title: 'A video in 10 seconds',
        text: "A video arrives almost at once: a hand turning a sealed box under a bright light. It looks real. But it could be anyone's box, filmed anywhere, any time.",
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: "to rely on Barang's own checkout and buyer protection, not proof the seller sends",
        ifItHappened: "stop and don't pay. If money already went out, tell a parent and report the shop to Barang Market.",
      },
    },
    {
      id: 'checkout-only',
      label: "Don't pay. Buy only with Barang's checkout, and report the shop",
      safety: 'safe',
      outcome: {
        title: 'Jun keeps his S$25',
        text: 'Jun replies: "Only through Barang checkout." LegendVault goes quiet. Jun reports the shop and tells Theo why. He decides to save up for the S$108 box next door, with buyer protection.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: "to use the platform's own checkout with buyer protection, or to walk away and report the listing",
        ifItHappened: 'report the listing to Barang Market and tell a parent. Keep the chats as evidence.',
      },
      aftershock: {
        id: 'afterglow-listing',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'NEXT WEEK',
        title: 'Afterglow: the fake stall comes down',
        text: "Barang Market removes LegendVault and warns everyone who looked at the listing. Two kids from the card club hadn't paid yet. Now they won't.",
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'checkout-only', text: "Buyer protection only works inside Barang's checkout. Once you pay outside it, there is no way back." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'checkout-only', text: 'Every review was hung on one day, and the booth is cardboard at the back.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'ask-video', text: 'Jun has wanted this box for months, and the price is amazing. A video would show the box is real, so asking for one seems fair.' },
  ],
  peerShield: {
    friend: 'theo',
    timeLabel: 'ONE WEEK LATER',
    setup: 'Theo found a different pre-order on ChatLah: a Metro Legends gold tin at a third of the price. The deposit closes at midnight, and his thumb is over Pay.',
    messages: [
      { from: 'theo', text: 'this seller has 300 reviews, must be legit' },
      { from: 'theo', text: 'deposit closes at 12. paying now ok' },
      { from: 'theo', text: "don't tell my mum, she always says no" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-see', text: 'Wait, can I see it first?', quality: 'great', why: 'A calm pause, without judging, keeps him talking to you.', guard: -15, doubt: 10 },
        { id: 'o-hmm', text: 'Hmm, not sure about this.', quality: 'ok', why: 'Honest, but it does not help him stop.', guard: -5, doubt: 5 },
        { id: 'o-again', text: "Again? Didn't you learn anything last week?", quality: 'harmful', why: 'Shaming him makes him defensive, and more likely to pay just to prove a point.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-checkout', text: "If you pay outside the shop's checkout, you can't get it back. Fake shops count on that.", quality: 'great', why: 'Gives a clear reason and puts the blame on the fake shop.', guard: -5, doubt: 25 },
        { id: 'r-cheap', text: "It's really cheap...", quality: 'ok', why: 'True, but he needs to know why cheap is a problem.', guard: 0, doubt: 10 },
        { id: 'r-reviews', text: '300 reviews, should be fine.', quality: 'harmful', why: 'Reviews can be faked in one day. This tells him to stop checking.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-look', text: "Let's look at the shop on Barang's app together first. I'll help you check.", quality: 'great', why: 'A concrete offer to check together makes the safe step easy.', guard: -10, doubt: 15 },
        { id: 'f-wait', text: 'Maybe wait a day?', quality: 'ok', why: 'Waiting is better than paying, but it leaves him alone with the timer.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "OK, pay. I won't tell your mum.", quality: 'harmful', why: 'A secret keeps away the person most likely to help.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-parent', text: 'Ask your mum to check it with you, or call the ScamShield Helpline 1799.', quality: 'great', why: 'Points to a trusted adult and an official helpline.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Search the shop name online.', quality: 'ok', why: 'It can help a little, but fake shops change names often.', guard: 0, doubt: 5 },
        { id: 'c-seller', text: 'Ask the seller for more proof.', quality: 'harmful', why: 'A decoy: the seller controls every "proof" they send.', guard: 0, doubt: -10 },
      ],
    },
    outcomes: {
      success: 'Theo checks the shop with Jun: it opened four days ago and has no sales through checkout. "ok... not paying. thanks for checking with me."',
      partial: 'Theo: "ok, I\'ll wait a bit." He hasn\'t decided yet. Checking in tomorrow could help.',
      fail: 'Theo: "you just don\'t want me to have it. paying now." Seen.',
    },
  },
  ifThen: {
    if: "a seller wants me to pay outside the shop's checkout, or pay a deposit now for something that comes months later",
    then: 'pay only through the checkout with buyer protection, or walk away and tell an adult',
  },
  help: ['trusted-adult', 'scamshield-1799', 'scamshield-report', 'bank', 'tinkle-friend', 'mindline-1771'],
  sources: [
    { label: 'Mid-Year Scam and Cybercrime Brief 2026: e-commerce and trading-card pre-order scams', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'I can ACT against scams: Add, Check, Tell', publisher: 'ScamShield (scamshield.gov.sg)', asOf: '2026-10-08', url: 'https://www.scamshield.gov.sg' },
    { label: 'ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
    { label: 'Tinkle Friend and mindline 1771 (partner list)', publisher: 'Online Safety Commission, Get support from our partners', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
