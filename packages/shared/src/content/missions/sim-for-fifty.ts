import type { Mission } from '../../mission';

// M08 SIM for Fifty (GAME_DESIGN.md §9.2), 17-24 only. A friend-of-a-friend pays S$50 per prepaid SIM registered in
// Hafiz's name and handed over "for workers who can't register".
// - The SIM-offence line follows [S7] word for word in substance ("can be an offence", "up to"), and never states
//   the commencement date, which is not verified.
// - Mobile-line restrictions [S4] are phrased as "may". The only SPF quote is the [S3] "strictly for personal use"
//   line. Saw-something channel: Police Hotline 1800 255 0000 or i-Witness [S1].
// - The deep structure mirrors Easy Money (your identity is the product); the surface is a phone shop, not a bank.

export const simForFifty: Mission = {
  id: 'sim-for-fifty',
  version: 1,
  title: 'SIM for Fifty',
  district: 'retail-district',
  scene: 'minimart',
  bands: ['young-adult'],
  theme: 'Suspicious request and SIM misuse',
  premise:
    "Irfan's friend Ray offers Hafiz S$50 for every prepaid SIM he registers in his own name and hands over, \"for workers who can't register\".",
  skillFocus: ['I', 'E'],
  timeOfDay: 'evening',
  scaffold: 'light',
  resident: 'hafiz',
  cast: [
    { id: 'hafiz', name: 'Hafiz', role: 'resident', anchor: 'phone-shop', pose: 'phone', look: { body: '#34d399', accent: '#064e3b', hair: 'short' } },
    { id: 'assistant', name: 'Shop assistant', role: 'bystander', anchor: 'phone-shop', pose: 'stand', look: { body: '#2dd4bf', accent: '#134e4a', hair: 'hijab' } },
    { id: 'irfan', name: 'Irfan', role: 'friend', anchor: 'door', pose: 'phone', look: { body: '#f97316', accent: '#7c2d12', hair: 'cap' } },
    { id: 'ray', name: "Ray (Irfan's friend)", role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
  ],
  intro:
    'Lumen Mall, Thursday, 7.10pm. Hafiz, 18, is at the phone accessory shop buying a prepaid SIM for his new phone. His friend Irfan waits outside MiniMart 24 with a drink. Irfan gave Hafiz\'s number to someone called Ray.',
  live: {
    durationSec: 55,
    decisionPrompt: 'The assistant rings up Hafiz\'s own SIM and asks, "Anything else?" What should Hafiz do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: "Hafiz's phone buzzes. A ChatLah message from Ray, a friend of Irfan's he has never met." },
      { id: 'b2', at: 4, from: 'ray', channel: 'chat', text: "Irfan says you're at the phone shop now? Perfect timing. Easy S$50 per SIM 💸", tactic: 'too-good' },
      { id: 'b3', at: 9, from: 'ray', channel: 'chat', text: 'Register 3 more prepaid SIMs in your name and pass them to me. S$150, done.', attachment: { kind: 'job', label: 'SIM help (cash)', detail: '3 SIMs · S$50 each · paid after handover' } },
      { id: 'b4', at: 14, from: 'assistant', channel: 'speech', text: 'Can I see your IC? Every SIM is registered to the person buying it.' },
      { id: 'b5', at: 19, from: 'hafiz', channel: 'chat', text: "Why can't they buy their own?" },
      { id: 'b6', at: 23, from: 'ray', channel: 'chat', text: 'For foreign workers lah. No local ID, cannot register. They just want to call home.' },
      { id: 'b7', at: 28, from: 'irfan', channel: 'speech', text: 'I did two last month, bro. Easy money. Nothing happened.', tactic: 'everyone-does-it' },
      { id: 'b8', at: 33, from: 'ray', channel: 'chat', text: "Who uses them? You don't need to know. Better for you.", tactic: 'secrecy' },
      { id: 'b9', at: 38, from: 'ray', channel: 'chat', text: 'I pay after you pass me the SIMs. Cash only, no transfer.' },
      { id: 'b10', at: 44, from: 'irfan', channel: 'speech', text: "Come on, I already told Ray you're in. Don't make me look bad.", tactic: 'loyalty' },
      { id: 'b11', at: 50, from: 'ray', channel: 'chat', text: 'Shop closes at 9. If not tonight, I ask someone else.', tactic: 'urgency' },
    ],
  },
  clues: [
    { id: 'c-pay', label: 'S$50 a SIM, for a few minutes at a counter', target: { kind: 'beat', beatId: 'b2' }, redFlag: true, tactic: 'too-good', explain: 'Nobody pays S$150 for twenty minutes of queueing unless what you are handing over is worth much more to them. Here, that is your name on three phone lines.' },
    { id: 'c-name', label: "Three lines in Hafiz's name, used by someone else", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: 'Each SIM is tied to the person who registers it. Whatever happens on those lines leads back to Hafiz, not to Ray or the "workers".' },
    { id: 'c-story', label: 'A sympathetic story about workers that Hafiz cannot check', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: 'A kind-sounding reason makes it feel like a favour. Hafiz has no way to know who these "workers" are, or whether they exist at all.' },
    { id: 'c-dontknow', label: '"You don\'t need to know"', target: { kind: 'beat', beatId: 'b8' }, redFlag: true, tactic: 'secrecy', explain: 'If the lines were for something harmless, Ray would happily say who uses them. Keeping Hafiz in the dark keeps the risk on him.' },
    { id: 'c-handover', label: 'Paid only after the handover, in cash', target: { kind: 'beat', beatId: 'b9' }, redFlag: true, explain: 'Cash leaves no record of Ray, and once the SIMs are handed over Hafiz has no say in how they are used. The paper trail points only at Hafiz.' },
    { id: 'c-deadline', label: '"If not tonight, I ask someone else"', target: { kind: 'beat', beatId: 'b11' }, redFlag: true, tactic: 'urgency', explain: 'The deadline is there to stop Hafiz from asking anyone. A genuine request would survive a night to think it over.' },
    { id: 'c-chain', label: 'Up close on Irfan\'s phone: Ray offers him S$20 "for every friend who signs up"', target: { kind: 'anchor', anchor: 'door' }, redFlag: true, explain: 'Irfan is paid to bring in friends, and Ray is paid for every line he collects. Everyone in the chain earns from the next person taking the risk.' },
    { id: 'c-id', label: 'The assistant asks for Hafiz\'s IC', target: { kind: 'beat', beatId: 'b4' }, redFlag: false, explain: 'Normal. A shop checking ID for a SIM is what is supposed to happen. It is also exactly why a line in your name leads back to you.' },
    { id: 'c-promo', label: 'The shop\'s own poster: "Weekend deal: 100GB prepaid for S$15"', target: { kind: 'anchor', anchor: 'phone-shop' }, redFlag: false, explain: 'An ordinary promotion from the shop itself. Cheap SIMs are not the warning sign; someone paying you to register them for others is.' },
  ],
  influence: {
    from: 'ray',
    hidden: {
      label: 'Whoever really uses the lines',
      description:
        'Ray is a middleman paid for every SIM he collects. The lines go to people who need phone numbers that cannot be traced to them, for example to contact scam victims.',
    },
    question: 'Pull the thread from Ray. What does Ray get if Hafiz hands over the SIMs?',
    options: [
      { id: 'i-help', text: 'Nothing. He is just helping some workers.', correct: false, explain: 'Ray never names a worker, and he pays cash. The thread runs straight past the "workers" story.' },
      { id: 'i-paid', text: 'He is paid for every SIM he passes on to whoever really uses them.', correct: true, explain: 'Right. Ray is paid per SIM. The lines stay in Hafiz\'s name, so if they are misused, they lead to Hafiz, not to Ray.' },
      { id: 'i-change', text: 'He keeps some change from the S$150.', correct: false, explain: "Close, but Ray's real money comes from passing the SIMs on. Either way, the risk sits with Hafiz." },
    ],
  },
  forecast: {
    question: 'If Hafiz hands over the SIMs, what is most likely by next month?',
    horizon: 'next-month',
    options: [
      { id: 'f-easy', text: 'Nothing. He keeps S$150 and never hears about it again.', likely: false },
      { id: 'f-traced', text: 'One of the lines is used in a scam, and police contact Hafiz because it is in his name.', likely: true },
      { id: 'f-job', text: 'Ray offers him a steady job.', likely: false },
    ],
    explain: 'A SIM is registered to one person. When a line is used to contact scam victims, the trail leads to the name on the registration, not to whoever was holding the phone.',
  },
  choices: [
    {
      id: 'hand-over',
      label: 'Register all three and hand them over',
      safety: 'risky',
      outcome: {
        title: '+S$150',
        text: 'Three SIMs, three forms, one IC. Ray meets Hafiz outside the mall and counts out S$150 in cash. "Pleasure doing business." It took twenty minutes.',
        mood: 'shiny',
        effects: { wallet: 150 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to never register a SIM, bank account or login for someone else, whatever the reason or the payment',
        ifItHappened: 'stop, keep the chats, tell a trusted adult, and give the police what you know. Coming forward early matters.',
      },
      aftershock: {
        id: 'line-traced',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '5 WEEKS LATER',
        title: "A line in Hafiz's name",
        text: "A letter asks Hafiz to contact the police. One of the SIMs registered in his name was used to call people who later lost money to a scam. Ray's ChatLah account is gone. When Hafiz tries to sign up for a new mobile plan, the shop tells him it can't go through right now.",
        effects: { trust: -2, risk: 2 },
        fact: {
          text: 'Handing over SIM cards registered in your name for unlawful use can be an offence. For a first offence, penalties may include a fine of up to S$10,000, jail of up to 3 years, or both. People linked to scams may also face restrictions on getting new mobile lines.',
          source: 'SPF, Misuse of SIM Card Offences; SPF, Mid-Year Scam and Cybercrime Brief 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'The letter is on the table. What should Hafiz do now?',
          options: [
            { id: 'r-come', text: 'Tell his family, keep every chat with Ray, and go to the police with everything he knows.', good: true, response: "That's the strongest move. The chats show how Ray recruited him, and coming forward early helps police reach the people behind the lines. Beacon lights up.", help: ['trusted-adult', 'police-hotline'] },
            { id: 'r-ray', text: 'Message Ray and ask him to stop using the lines.', good: false, response: "Ray gains from Hafiz staying quiet, and his account is already gone. The people who can actually help are Hafiz's family and the police." },
            { id: 'r-delete', text: 'Delete the chats so nothing links him to Ray.', good: false, response: "Panicking is a normal reaction. But those chats are what show Ray recruited him. It's not too late: keep them and tell someone." },
          ],
        },
      },
    },
    {
      id: 'just-one',
      label: 'Register just one, as a test',
      safety: 'risky',
      outcome: {
        title: '+S$50',
        text: 'One SIM, one form. Ray sends a thumbs-up and meets Hafiz with S$50 in cash. "Smooth, bro. Two more next week?"',
        mood: 'shiny',
        effects: { wallet: 50, risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        saferMove: 'to judge the first SIM as if it were the last. One line in your name can be misused just as easily as three',
        ifItHappened: 'stop now, keep the chat, tell a trusted adult, and give the police what you know about Ray.',
      },
      aftershock: {
        id: 'one-line-traced',
        polarity: 'risk',
        afterMissions: 2,
        timeLabel: '6 WEEKS LATER',
        title: 'Just one was enough',
        text: 'Ray never stopped at one: "two more" arrives every week. Then the police get in touch. The one line in Hafiz\'s name was used to contact people in a scam, and it led straight back to him.',
        effects: { trust: -2, risk: 2 },
        fact: {
          text: 'Handing over SIM cards registered in your name for unlawful use can be an offence, with penalties for a first offence of up to S$10,000 fine and/or up to 3 years\' jail.',
          source: 'SPF, Misuse of SIM Card Offences',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'The police want to talk. What should Hafiz do now?',
          options: [
            { id: 'r-come', text: "Stop replying to Ray, tell his family, and give the police the chats and everything he knows about Ray.", good: true, response: "That's the strongest move. The chats show how the request was made, and coming forward early helps. Beacon lights up.", help: ['trusted-adult', 'police-hotline'] },
            { id: 'r-small', text: 'Tell himself it was only one SIM, so it does not really count.', good: false, response: 'It is natural to want it to be small. But the line is in his name either way. Telling someone and coming forward is still the next step.' },
          ],
        },
      },
    },
    {
      id: 'ask-proof',
      label: "Ask Ray for the workers' names and work permits first",
      safety: 'unsure',
      outcome: {
        title: '"Proof" arrives',
        text: 'Ray sends three blurry work-permit photos with the names covered, then a voice note: "Satisfied? Shop closes soon." None of it can be checked, and the clock just got louder.',
        mood: 'sober',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'fake-proof',
        saferMove: 'to step out of the deal, not negotiate it. No proof makes a line in your name safe to hand over',
        ifItHappened: 'stop replying, keep the chat, and talk to a trusted adult. You can give information to the Police Hotline 1800 255 0000 or through i-Witness.',
      },
    },
    {
      id: 'refuse-report',
      label: 'Refuse, keep the chat, tell a trusted adult, and give information to police',
      safety: 'safe',
      outcome: {
        title: 'Hafiz walks away',
        text: '"Just my own SIM, thanks." Hafiz replies to Ray: "Not doing it." He screenshots the chat, tells his older sister that night, and they send what they know to the police through i-Witness. Irfan is annoyed, then quiet.',
        mood: 'warm',
        effects: { trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'too-good',
        saferMove: 'to refuse, keep the chat as evidence, and give information to police through the Police Hotline 1800 255 0000 or i-Witness',
        ifItHappened: 'if you already handed over a SIM, tell a trusted adult and the police now. Coming forward early matters.',
      },
      aftershock: {
        id: 'afterglow-group-warned',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '2 WEEKS LATER',
        title: 'Afterglow: the group chat is warned',
        text: 'Hafiz posts in his class group chat: "If anyone offers cash for SIMs in your name, don\'t. Ask me why." Two classmates reply that Ray had messaged them too. Neither of them goes ahead.',
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
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'refuse-report', text: 'Everything we know about the "workers" comes from Ray, and he won\'t say who uses the lines. The one fact we can check is that the SIMs will be in Hafiz\'s name.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'just-one', text: "Hafiz doesn't want to embarrass Irfan, and S$50 is real money to him. Doing just one feels like a way to help without going all in." },
    { id: 'p-lead', role: 'Safety Lead', leaning: 'refuse-report', text: 'A SIM in your name is your identity in someone else\'s pocket. Whoever uses it, it leads back to you.' },
  ],
  peerShield: {
    friend: 'irfan',
    timeLabel: '1AM, THREE WEEKS LATER',
    setup:
      'Irfan messages Hafiz in the middle of the night. One of the SIMs he handed Ray last month was used for scam calls, and the police have called his house. Ray wants two new SIMs "to replace the old ones".',
    messages: [
      { from: 'irfan', text: 'bro police called my house. one of the SIMs I gave ray was used for scam calls' },
      { from: 'irfan', text: 'ray says register 2 new ones for him then he will settle everything' },
      { from: 'irfan', text: "don't tell anyone ok. my parents will flip" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-here', text: "Thanks for telling me. I'm not going anywhere.", quality: 'great', why: 'Thanking him for speaking up lowers his guard.', guard: -20, doubt: 5 },
        { id: 'o-think', text: 'Okay. Let me think.', quality: 'ok', why: 'Calm, but it does not make him feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-told', text: 'Wah, I told you not to do it.', quality: 'harmful', why: 'Blame makes people defensive and more likely to hide the problem.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-used', text: "Ray used your name so his own stays clean. That's on him. Telling the police the truth early is what helps you.", quality: 'great', why: 'Blames the scheme, not Irfan, and gives a clear reason to come forward.', guard: -5, doubt: 25 },
        { id: 'r-worse', text: 'Registering more will only make it worse.', quality: 'ok', why: 'True, but on its own it sounds like a verdict.', guard: 0, doubt: 10 },
        { id: 'r-two', text: 'Just do the two, then block Ray.', quality: 'harmful', why: 'Two more lines in his name means two more ways to be traced, and Ray cannot settle anything with the police.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-come', text: "I won't spread it around. But this needs someone who can help, and I'll come with you to tell your parents.", quality: 'great', why: 'Respects his privacy without keeping a harmful secret, and makes the hard step easier.', guard: -10, doubt: 15 },
        { id: 'f-maybe', text: 'Maybe talk to someone?', quality: 'ok', why: 'Kind, but it leaves him to do it alone at 1am.', guard: -5, doubt: 5 },
        { id: 'f-promise', text: "Okay, I won't tell anyone. Promise.", quality: 'harmful', why: 'A secrecy pact is exactly what Ray needs.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-police', text: 'Keep every chat with Ray. Call the police back with your parents beside you, or use the Police Hotline 1800 255 0000.', quality: 'great', why: 'Points to official channels and a trusted adult, and keeps the evidence.', guard: -5, doubt: 15 },
        { id: 'c-search', text: 'Search online what happens next.', quality: 'ok', why: 'Searching at 1am can lead to more fake "helpers". Official channels are safer.', guard: 0, doubt: 0 },
        { id: 'c-ray', text: 'Ask Ray to sort it out with the police.', quality: 'harmful', why: 'A decoy channel: Ray gains from Irfan staying quiet and in the chain.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Irfan: "ok. can you be there tmr when I tell my parents? thanks for not scolding me." He blocks Ray, keeps the chats, and calls the police back with his dad the next day.',
      partial: 'Irfan: "maybe... let me sleep on it." Checking in tomorrow morning could help.',
      fail: 'Irfan: "forget it, I\'ll handle it myself." Seen.',
    },
  },
  ifThen: {
    if: 'someone offers to pay me to register a SIM card, bank account or login for them',
    then: 'say no, keep the chat, and tell a trusted adult or give information to police',
  },
  help: ['trusted-adult', 'police-hotline', 'scamshield-1799', 'mindline-1771'],
  sources: [
    { label: 'Misuse of SIM Card Offences (commencement date not verified; not stated in game)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Mid-Year Scam and Cybercrime Brief 2026 (26 Aug 2026): restrictions on new mobile lines', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Annual Scam and Cybercrime Brief 2025 (25 Feb 2026): "strictly for personal use only" quote', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Police Hotline 1800 255 0000, i-Witness and ScamShield Helpline 1799', publisher: 'Singapore Police Force, Contact Us', asOf: '2026-10-08', url: 'https://www.police.gov.sg/contact-us' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
