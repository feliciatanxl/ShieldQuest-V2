import type { Mission } from '../../mission';

// M10 Behind the Stall, 17-24 variant (GAME_DESIGN.md §9.2): a concert-lightstick deposit. Same deep structure as
// behind-the-stall (fake shopfront, same-day reviews, payment off the platform), with more ambiguous evidence for this
// band: a "verified phone" badge, a real-looking unboxing, and a fourth, partly safe exit (meet and inspect).

export const behindTheStallYa: Mission = {
  id: 'behind-the-stall-ya',
  version: 1,
  title: 'Behind the Stall',
  district: 'digi-district',
  scene: 'digi-sky',
  bands: ['young-adult'],
  theme: 'Online shopping: pre-order deposit scam',
  premise: "Shu Fen needs a NOVA9 lightstick for next month's concert. A Barang Market seller has the official one at under half price. It's a pre-order, and the deposit goes by bank transfer, off the platform.",
  skillFocus: ['S', 'E'],
  timeOfDay: 'night',
  scaffold: 'light',
  resident: 'shufen',
  cast: [
    { id: 'shufen', name: 'Shu Fen', role: 'resident', anchor: 'chatlah-plaza', pose: 'phone', look: { body: '#c084fc', accent: '#4c1d95', hair: 'long' } },
    { id: 'hazel', name: 'Hazel', role: 'friend', anchor: 'arcade', pose: 'lean', look: { body: '#f472b6', accent: '#831843', hair: 'bun' } },
    { id: 'seller', name: 'NOVA9_GoodsHub', role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
  ],
  intro: "Digi Sky, 10.30pm. Shu Fen, 20, finally has tickets to see NOVA9 next month. Her lightstick broke last tour. She and Hazel are hunting for a new one on Barang Market.",
  live: {
    durationSec: 58,
    decisionPrompt: 'The transfer screen is open. What should Shu Fen do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'A neon booth: NOVA9_GoodsHub, 4.9 stars, under a long row of review lanterns.' },
      { id: 'b2', at: 4, from: 'seller', channel: 'chat', text: 'NOVA9 Official Lightstick v3, pre-order! S$38 only (official price S$85) 💜', tactic: 'too-good', attachment: { kind: 'listing', label: 'NOVA9 Official Lightstick v3 · PRE-ORDER', detail: 'S$38 · official S$85 · 4.9 stars (140 reviews)' } },
      { id: 'b3', at: 9, from: 'hazel', channel: 'speech', text: "Shu Fen, that's the one! Half the fan chat ordered from them.", tactic: 'everyone-does-it' },
      { id: 'b4', at: 14, from: 'seller', channel: 'chat', text: 'Ships in 6 weeks, in time for the concert. 50% deposit to reserve.', tactic: 'small-ask' },
      { id: 'b5', at: 19, from: 'shufen', channel: 'chat', text: 'Can we meet so I can see it first, and pay then?' },
      { id: 'b6', at: 23, from: 'seller', channel: 'chat', text: "Pre-order leh, stock not here yet. Let's move to ChatLah, Barang's chat charges fees." },
      { id: 'b7', at: 28, from: 'seller', channel: 'chat', text: 'Deposit S$19 by bank transfer to my account ya.', attachment: { kind: 'payment', label: 'Harbour Bank transfer', detail: 'To: T K Lim (personal account)' } },
      { id: 'b8', at: 33, from: 'seller', channel: 'chat', text: 'Unboxing from the last batch 😍', attachment: { kind: 'image', label: 'unboxing_v3.jpg', detail: 'A glowing purple lightstick next to its box' } },
      { id: 'b9', at: 39, from: 'narrator', channel: 'scene', text: 'The seller\'s profile shows a small badge: "Phone verified ✓".' },
      { id: 'b10', at: 45, from: 'seller', channel: 'chat', text: 'Only 2 left at this price. Deposit by 11pm or I release it.', tactic: 'urgency' },
      { id: 'b11', at: 51, from: 'hazel', channel: 'speech', text: "Just pay lah, if not we won't match at the concert!", tactic: 'loyalty' },
    ],
  },
  clues: [
    { id: 'c-price', label: 'Official lightstick at under half the official price', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Official merch rarely sells far below the official store. A price this low is there to make you skip the checks.' },
    { id: 'c-months', label: 'A deposit now for something that ships in 6 weeks', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'small-ask', explain: 'A long wait means the seller holds your money while you can check nothing. "Just a deposit" is how the first step is made to feel small.' },
    { id: 'c-offplatform', label: 'Move to ChatLah to "avoid fees"', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: "Leaving Barang's chat and checkout also leaves its buyer protection and its records. That is the point." },
    { id: 'c-name', label: 'Deposit to a personal account whose name is not the shop\'s', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, explain: 'Money sent by bank transfer to a personal account is hard to get back. And "T K Lim" is not "NOVA9_GoodsHub": who are you really paying?' },
    { id: 'c-deposit', label: '"Only 2 left. Deposit by 11pm"', target: { kind: 'beat', beatId: 'b10' }, redFlag: true, tactic: 'urgency', explain: 'A deadline cuts the time Shu Fen has to compare with the official store or ask anyone.' },
    { id: 'c-reviews', label: 'All 140 review lanterns were hung on the same day', target: { kind: 'anchor', anchor: 'review-lanterns' }, redFlag: true, tactic: 'fake-proof', explain: 'Genuine reviews build up slowly. A burst of five-star reviews on one day is a sign they were bought or made by the seller.' },
    { id: 'c-facade', label: 'Behind the booth: a cardboard front propped on sticks', target: { kind: 'anchor', anchor: 'barang-booth' }, redFlag: true, explain: 'The shop is only a front. There is no stock room, no history, nothing behind the sign. Even the "Phone verified" badge only means a number was checked once. It says nothing about whether anything will ship.' },
    { id: 'c-photos', label: 'A real-looking unboxing photo', target: { kind: 'beat', beatId: 'b8' }, redFlag: false, explain: 'It may well be a real lightstick, just not one this seller owns. Photos are easy to copy. Not a warning sign, and not proof.' },
    { id: 'c-official', label: 'The official NOVA9 store link: S$85, ships in a week', target: { kind: 'anchor', anchor: 'link-portal' }, redFlag: false, explain: 'Not a red flag: this is the comparison point. Checking the official store yourself is exactly the right move.' },
  ],
  influence: {
    from: 'seller',
    hidden: { label: 'A deposit collector', description: 'One person or crew running a throwaway shop: collect as many deposits as possible, then delete the account before the shipping date.' },
    question: 'Pull the thread from NOVA9_GoodsHub. Who gains, and when?',
    options: [
      { id: 'i-reseller', text: 'A reseller with spare stock, making a small profit.', correct: false, explain: 'A reseller with stock could meet and sell now. This one has "no stock yet" and a cardboard shop.' },
      { id: 'i-collector', text: 'Someone collecting deposits now, who disappears before anything has to ship.', correct: true, explain: 'Right. Six weeks of "pre-order" is six weeks to collect money and vanish. The personal account name is the thread.' },
      { id: 'i-fanclub', text: 'The fan club, raising money for the concert.', correct: false, explain: "Nothing links this shop to any fan club. Hazel's fan chat is being used to spread it." },
    ],
  },
  forecast: {
    question: 'If Shu Fen transfers the deposit, what is most likely by the shipping date?',
    horizon: 'next-month',
    options: [
      { id: 'f-arrives', text: 'The lightstick arrives in time for the concert.', likely: false },
      { id: 'f-gone', text: 'The seller and shop are gone, and the deposit with them.', likely: true },
      { id: 'f-delay', text: 'It arrives late, but it does arrive.', likely: false },
    ],
    explain: 'Deposits sent by bank transfer, outside the platform, are rarely recovered once a fake shop disappears.',
  },
  choices: [
    {
      id: 'pay-deposit',
      label: 'Transfer the S$19 deposit',
      safety: 'risky',
      outcome: {
        title: 'Reserved!',
        text: 'The seller sends a 💜 and an order receipt, "#NV3-0412". Hazel sends a screaming voice note. Concert ready.',
        mood: 'shiny',
        effects: { wallet: -19 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: "to pay only through the platform's checkout with buyer protection, or to buy from the official store",
        ifItHappened: 'call your bank on its official number about the transfer, report the listing to the platform, and make a police report.',
      },
      aftershock: {
        id: 'deposit-gone',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '6 WEEKS LATER',
        title: 'Two weeks before the concert: nothing',
        text: "The shipping date passes. The seller's ChatLah is deleted and the Barang shop is gone. Shu Fen's S$19 is gone too, and in the fan chat, more people say they paid.",
        effects: { trust: -2, risk: 1 },
        fact: {
          text: 'E-commerce scams had the most cases of any scam type in Singapore in 2025 (6,703), and rose again in the first half of 2026 (3,865 cases, up 19.3%).',
          source: 'SPF, Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026)',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'Shu Fen is angry and embarrassed. What now?',
          options: [
            { id: 'r-report', text: 'Call Harbour Bank about the transfer, report the listing to Barang Market, make a police report, and tell her family.', good: true, response: 'That is the strongest move. Reports are how fake shops get taken down, and the bank needs to hear about the transfer quickly. Beacon lights up.', help: ['bank', 'police-hotline', 'scamshield-report', 'trusted-adult'] },
            { id: 'r-agent', text: 'Pay a "refund agent" who DMs her offering to get the money back for a fee.', good: false, response: 'People who just lost money are often targeted again by fake "recovery" offers. Don\'t pay. Tell her family, then use the real routes: the bank and a police report. It isn\'t too late.' },
            { id: 'r-quiet', text: "Say nothing. It's only S$19.", good: false, response: "Wanting to move on is understandable. But reports are how shops like this get taken down before they reach more fans. It's still worth reporting, and telling someone helps." },
          ],
        },
      },
    },
    {
      id: 'ask-video',
      label: 'Ask for a live video of the lightstick first',
      safety: 'unsure',
      outcome: {
        title: 'Convincing, and confusing',
        text: 'A minute later: a video of a glowing lightstick next to a note with Shu Fen\'s name on it. Convincing. But the seller said there was no stock yet. So whose lightstick is that?',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to rely on protection you control, like the platform checkout, not proof the seller produces',
        ifItHappened: "hold off on paying. If you already transferred money, call your bank on its official number and report the listing.",
      },
    },
    {
      id: 'meet-inspect',
      label: 'Offer to meet in public, check it, and pay on the spot',
      safety: 'unsure',
      outcome: {
        title: '"Can hold for S$10"',
        text: 'The seller says it is a pre-order, so there is nothing to see yet. Then: "Can hold one for you, S$10 holding fee." Meeting is a good habit for things that exist. A pre-order can\'t be inspected.',
        mood: 'mixed',
        effects: {},
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to meet only for items that exist, in a busy public place with a friend, and to walk away from any "holding fee"',
        ifItHappened: 'report the listing and call your bank on its official number about any fee you paid.',
      },
    },
    {
      id: 'checkout-only',
      label: 'Walk away: buy through checkout or the official store, and report',
      safety: 'safe',
      outcome: {
        title: 'Lightstick, the boring way',
        text: 'Shu Fen replies "Only via Barang checkout." The seller blocks her. She reports the listing and orders the S$85 lightstick from the official NOVA9 store. It arrives in a week.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to walk away from deposits outside the platform, and to buy through the checkout or the official store',
        ifItHappened: 'call your bank about the transfer, report the listing and make a police report. Acting fast helps.',
      },
      aftershock: {
        id: 'afterglow-fanchat',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: 'NEXT WEEK',
        title: 'Afterglow: the fan chat is warned',
        text: 'Barang Market removes the listing. Shu Fen posts in the fan chat: "If they want a deposit outside checkout, walk away." Hazel and two others hadn\'t paid yet. Now they won\'t.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'checkout-only', text: "If the deal only works outside buyer protection, it isn't a deal. It's a deposit with no way back." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'checkout-only', text: "The account name doesn't match the shop, and every review was hung on the same day." },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'meet-inspect', text: 'Shu Fen really wants to match with Hazel at the concert. Meeting in person and checking the lightstick sounds careful, not reckless.' },
  ],
  peerShield: {
    friend: 'hazel',
    timeLabel: '3 WEEKS LATER',
    setup: 'Hazel found someone in the fan chat reselling NOVA9 fan-meet tickets. They want an S$80 deposit by bank transfer tonight to "hold" two seats. Her banking app is already open.',
    messages: [
      { from: 'hazel', text: 'omg someone in the chat is reselling fan-meet tix!!' },
      { from: 'hazel', text: 'S$80 deposit to hold 2 seats, transfer by tonight' },
      { from: 'hazel', text: "don't tell anyone ok, else everyone will want" },
    ],
    start: { guard: 55, doubt: 25 },
    slots: {
      opener: [
        { id: 'o-see', text: 'Wait, can I see the chat first?', quality: 'great', why: 'A curious pause, without judging, keeps her open.', guard: -15, doubt: 10 },
        { id: 'o-hmm', text: 'Hmm, okay...', quality: 'ok', why: 'Not unkind, but it does not slow her down.', guard: -5, doubt: 5 },
        { id: 'o-always', text: 'You always jump at these things.', quality: 'harmful', why: 'Shame makes people defensive, and more likely to pay to prove you wrong.', guard: 25, doubt: -5 },
      ],
      reason: [
        { id: 'r-transfer', text: 'A deposit by bank transfer to a stranger has no protection. Resale scams count on the rush.', quality: 'great', why: 'Names the risk and the tactic, and blames the scam, not her.', guard: -5, doubt: 25 },
        { id: 'r-sus', text: 'Sounds a bit sus.', quality: 'ok', why: 'True, but vague. She needs a reason.', guard: 0, doubt: 10 },
        { id: 'r-fine', text: "It's only S$80, worst case you lose a bit.", quality: 'harmful', why: 'Dismissing the risk tells her to stop checking.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-check', text: "Let's check the official ticket site together first. If it's real, it'll still be there.", quality: 'great', why: 'A concrete offer to check together, through a source she controls.', guard: -10, doubt: 15 },
        { id: 'f-later', text: 'Maybe think about it?', quality: 'ok', why: 'Kind, but it leaves her alone with the deadline.', guard: -5, doubt: 5 },
        { id: 'f-secret', text: "OK, I won't tell anyone.", quality: 'harmful', why: 'A secrecy pact is exactly what the seller asked for.', guard: -5, doubt: -10 },
      ],
      channel: [
        { id: 'c-official', text: "Only buy through the official ticketing resale. If you're unsure, call ScamShield 1799.", quality: 'great', why: 'Points to official channels she can check herself.', guard: -5, doubt: 15 },
        { id: 'c-search', text: "Search the seller's name online.", quality: 'ok', why: 'It can help a little, but throwaway accounts change names.', guard: 0, doubt: 5 },
        { id: 'c-seller', text: 'Ask the seller for a photo of the tickets.', quality: 'harmful', why: 'A decoy: the seller controls every photo they send.', guard: 0, doubt: -10 },
      ],
    },
    outcomes: {
      success: 'Hazel: "ok you\'re right. the official resale opens next week anyway. thanks for not making me feel silly." She reports the seller in the fan chat.',
      partial: 'Hazel: "ok, I\'ll wait till tomorrow." She hasn\'t decided. Checking in tomorrow could help.',
      fail: 'Hazel: "you\'re overthinking. transferring now." Seen.',
    },
  },
  ifThen: {
    if: "a seller wants a deposit by bank transfer, outside the platform's checkout",
    then: 'walk away, buy through the checkout or the official store, and report the listing',
  },
  help: ['scamshield-1799', 'scamshield-report', 'bank', 'police-hotline', 'trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'Mid-Year Scam and Cybercrime Brief 2026: e-commerce scam cases', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
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
