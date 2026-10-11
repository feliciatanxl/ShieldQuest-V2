import type { Mission } from '../../mission';

// M05 Five-Finger Dare (GAME_DESIGN.md §9.2), teen band. The junior "Keep Watch" variant is five-finger-dare-junior.
// Safety rules for this mission:
// - No theft method is ever shown or hinted (no self-checkout tricks, tags, blind spots). Every clue is social.
// - Consequences stay realistic and proportionate: stopped at the store, police and parents involved, possibly the
//   Guidance Programme [S13]. No jail threat.
// - Look-out liability is medium confidence [S20], so the game only says "being the look-out can also get you into
//   trouble" and never quotes a law. Verify on sso.agc.gov.sg before any stronger wording.
// Facilitator notes (not shown to players): 4,109 shop theft cases in 2025, and shop theft is among the top offences
// for arrested youths [S14]; youths *investigated* for shop theft rose 28.8% in H1 2026 [S16].

export const fiveFingerDare: Mission = {
  id: 'five-finger-dare',
  version: 1,
  title: 'Five-Finger Dare',
  district: 'retail-district',
  scene: 'minimart',
  bands: ['teen'],
  theme: 'Shop-theft dare and look-out',
  premise: "Darren's friends dare him to take a S$4 lip balm without paying, filmed for the group chat. Jia Hui is told to keep watch.",
  skillFocus: ['H', 'I', 'E', 'D'],
  timeOfDay: 'afternoon',
  scaffold: 'guided',
  resident: 'darren',
  cast: [
    { id: 'darren', name: 'Darren', role: 'resident', anchor: 'aisle-beauty', pose: 'stand', look: { body: '#38bdf8', accent: '#0c4a6e', hair: 'short' } },
    { id: 'marcus', name: 'Marcus', role: 'pressurer', anchor: 'aisle-snacks', pose: 'phone', look: { body: '#f97316', accent: '#7c2d12', hair: 'cap' } },
    { id: 'jiahui', name: 'Jia Hui', role: 'friend', anchor: 'door', pose: 'stand', look: { body: '#f472b6', accent: '#831843', hair: 'long' } },
    { id: 'staff', name: 'Store staff', role: 'bystander', anchor: 'counter', pose: 'stand', look: { body: '#2dd4bf', accent: '#134e4a', hair: 'short' } },
    { id: 'ethan', name: 'Ethan', role: 'pressurer', faceless: true, look: { body: '#334155', accent: '#0f172a', hair: 'none' } },
    { id: 'mum', name: 'Mum', role: 'trusted', faceless: true, look: { body: '#a3e635', accent: '#365314', hair: 'bun' } },
  ],
  intro: 'MiniMart 24, Saturday, 4.15pm. Darren is in the beauty aisle with his friends Marcus and Jia Hui. Marcus has his phone out, and he is grinning.',
  live: {
    durationSec: 55,
    decisionPrompt: 'Marcus is counting down, and the camera is on Darren. What should Darren do?',
    beats: [
      { id: 'b1', at: 1, from: 'narrator', channel: 'scene', text: 'Marcus points his phone at Darren. The Sat Squad group chat is open on his screen.' },
      { id: 'b2', at: 4, from: 'marcus', channel: 'speech', text: 'Okay Darren, dare number four. That S$4 lip balm. No paying.' },
      { id: 'b3', at: 9, from: 'marcus', channel: 'speech', text: "I'm filming it for the Sat Squad video. Confirm got views." },
      { id: 'b4', at: 14, from: 'ethan', channel: 'chat', text: "Did mine last week. So easy. Everyone's done it 😎", tactic: 'everyone-does-it' },
      { id: 'b5', at: 19, from: 'marcus', channel: 'speech', text: "It's only four dollars lah. Nobody's going to miss it.", tactic: 'small-ask' },
      { id: 'b6', at: 24, from: 'mum', channel: 'notification', text: 'Mum: Topped up your card for the week 🙂 Buy yourself something nice.' },
      { id: 'b7', at: 30, from: 'marcus', channel: 'speech', text: 'Jia Hui will keep watch at the door. Relax.' },
      { id: 'b8', at: 35, from: 'jiahui', channel: 'speech', text: 'Um... okay. I guess.' },
      { id: 'b9', at: 40, from: 'marcus', channel: 'speech', text: "Don't be scared lah. Or you're not really Sat Squad?", tactic: 'loyalty' },
      { id: 'b10', at: 46, from: 'ethan', channel: 'chat', text: "Hurry up, Marcus's bus comes in 5 mins 😂", tactic: 'urgency' },
      { id: 'b11', at: 51, from: 'marcus', channel: 'speech', text: "Okay, I'm recording. Three... two..." },
    ],
  },
  clues: [
    { id: 'c-video', label: "The dare is content for Marcus's video", target: { kind: 'beat', beatId: 'b3' }, redFlag: true, explain: 'Marcus gets the views. Darren takes all the risk. When a dare is filmed for likes, ask who it is really for.' },
    { id: 'c-easy', label: 'Ethan: "So easy. Everyone\'s done it"', target: { kind: 'beat', beatId: 'b4' }, redFlag: true, tactic: 'everyone-does-it', explain: '"Everyone" is one message from one person. It is meant to make taking something feel normal and safe. It is neither.' },
    { id: 'c-only4', label: '"It\'s only four dollars"', target: { kind: 'beat', beatId: 'b5' }, redFlag: true, tactic: 'small-ask', explain: 'A small price does not make it small. Taking something without paying is theft, whether it costs S$4 or S$400.' },
    { id: 'c-mum', label: 'Darren can pay: Mum just topped up his card', target: { kind: 'beat', beatId: 'b6' }, redFlag: true, explain: "This dare was never about needing a lip balm. It is about the video and proving something to the group. Mum's trust is part of what is at stake." },
    { id: 'c-watch', label: 'Jia Hui is told to keep watch', target: { kind: 'beat', beatId: 'b7' }, redFlag: true, explain: 'Being the look-out is not a safe middle role. It can also get you into trouble, and now the dare pulls in two friends instead of one.' },
    { id: 'c-cameras', label: 'Store notice: "CCTV in operation"', target: { kind: 'anchor', anchor: 'cctv' }, redFlag: true, explain: "Store cameras can help identify people who come back, even if they weren't caught at the time. A ten-second dare can follow you long after the video is forgotten." },
    { id: 'c-next', label: 'Marcus\'s phone: the dare list says "#5 Jia Hui"', target: { kind: 'anchor', anchor: 'aisle-snacks' }, redFlag: true, explain: 'The dares do not stop at Darren. Marcus is planning a series, and Jia Hui is next. Saying no now could help her too.' },
    { id: 'c-staff', label: 'A staff member restocking the shelf behind the counter', target: { kind: 'anchor', anchor: 'counter' }, redFlag: false, explain: 'This is ordinary work, not a warning sign and not a "chance". The dare is the problem, not who is watching.' },
  ],
  influence: {
    from: 'marcus',
    hidden: { label: 'The Sat Squad dare videos', description: 'Marcus posts a new dare clip every weekend. Each one gets him views and status in the group, while the person doing the dare carries all the risk.' },
    question: 'Pull the thread from Marcus. What does Marcus get if Darren does the dare?',
    options: [
      { id: 'i-fun', text: "Nothing. It's just a bit of fun between friends.", correct: false, explain: "It feels like fun, but the thread leads to Marcus's video series. He gains something; Darren risks everything." },
      { id: 'i-views', text: 'A new clip for his dare videos, with none of the risk.', correct: true, explain: 'Right. Marcus gets the views and the laughs. Darren is the one in the store, on camera, with the lip balm.' },
      { id: 'i-balm', text: 'The lip balm.', correct: false, explain: "Marcus doesn't even want it. The lip balm is just a prop for his video." },
    ],
  },
  forecast: {
    question: 'If Darren takes it, what could realistically happen in the next week?',
    horizon: 'next-week',
    options: [
      { id: 'f-nothing', text: 'Nothing. The video gets likes and everyone forgets it.', likely: false },
      { id: 'f-cameras', text: 'Darren is recognised when he goes back to the store, and the police and his parents get involved.', likely: true },
      { id: 'f-done', text: 'Marcus stops the dares, because Darren proved himself.', likely: false },
    ],
    explain: "Store cameras can help identify people who come back, even if they weren't caught at the time. And dares tend to grow: one \"yes\" usually leads to the next ask.",
  },
  choices: [
    {
      id: 'take-it',
      label: 'Take the lip balm for the video',
      safety: 'risky',
      outcome: {
        title: 'The group chat explodes',
        text: "Darren walks out without paying. Marcus's clip gets forty fire emojis in Sat Squad. For a moment, Darren feels like a legend.",
        mood: 'shiny',
        effects: { risk: 2 },
      },
      feedback: {
        tactic: 'everyone-does-it',
        saferMove: 'to turn the dare down with a light "nah", offer to pay or suggest something else, and walk out together',
        ifItHappened: "stop there, don't take any more dares, and tell a parent or another trusted adult. Being honest early, with an adult beside you, is the best way to start putting it right.",
      },
      aftershock: {
        id: 'stopped-at-store',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '4 DAYS LATER',
        title: 'Stopped at MiniMart 24',
        text: "Darren pops into MiniMart 24 for a drink. The manager asks him to wait: the store's camera system flagged him from Saturday. Staff call the police, and his parents are asked to come down. A police investigation will follow.",
        effects: { trust: -2, risk: 2 },
        fact: {
          text: "Store cameras can help identify people who come back, even if they weren't caught at the time. Young people may be placed on a six-month Guidance Programme instead of going to court.",
          source: 'SPF, Mid-Year Crime Brief 2026; MSF, Triage and pre-court diversionary programmes',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'It already happened. What should Darren do now?',
          options: [
            { id: 'r-honest', text: 'Tell the truth about what happened, with his parents beside him, and offer to pay for the lip balm.', good: true, response: "That's the strongest move. Being honest, with family beside him, is how Darren starts putting this right. Talking to a school counsellor can help with the stress too. Beacon lights up.", help: ['trusted-adult', 'mindline-1771'] },
            { id: 'r-marcus', text: "Say it was all Marcus's idea and he only did what he was told.", good: false, response: "Marcus's pressure was real, and Darren can say so. But leaving out his own part usually makes things harder. Telling the whole story, with a trusted adult beside him, is still the next step." },
            { id: 'r-delete', text: 'Delete the video and stay quiet.', good: false, response: "Deleting the clip doesn't undo what happened, and staying quiet makes it heavier to carry. It's not too late to talk to his parents or another trusted adult." },
          ],
        },
      },
    },
    {
      id: 'look-out',
      label: 'Be the look-out instead, and let Marcus take it',
      safety: 'risky',
      outcome: {
        title: 'Halfway in',
        text: 'Darren stands at the door while Marcus does the dare himself. Darren never touches the lip balm, but he is in the video too, keeping watch.',
        mood: 'mixed',
        effects: { risk: 1 },
      },
      feedback: {
        tactic: 'small-ask',
        designedTo: 'make a big part feel small, so "just keeping watch" seems safe',
        saferMove: 'to step out of the dare completely, not halfway. You can leave and still be friends',
        ifItHappened: "stop taking part, and talk to a parent or another trusted adult about what happened. It's not too late to put it right.",
      },
      aftershock: {
        id: 'look-out-on-camera',
        polarity: 'risk',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'The look-out is in the footage too',
        text: 'The store checked its cameras after the lip balm went missing. The footage shows Marcus at the shelf and Darren at the door, keeping watch. Both families get a call, and the police want to speak to both boys. Being the look-out can also get you into trouble.',
        effects: { trust: -2, risk: 2 },
        fact: {
          text: "Store cameras can help identify people who come back, even if they weren't caught at the time.",
          source: 'SPF, Mid-Year Crime Brief 2026',
          asOf: '2026-10-08',
        },
        recovery: {
          prompt: 'The call has come. What should Darren do now?',
          options: [
            { id: 'r-whole', text: 'Tell his parents the whole story, including the dare list, and be honest with the police.', good: true, response: "That's the strongest move. The whole story helps the adults see how the pressure worked, and it may stop the next dare on Marcus's list. Beacon lights up.", help: ['trusted-adult', 'mindline-1771'] },
            { id: 'r-waiting', text: "Say he was just waiting for a friend and didn't know.", good: false, response: "It's understandable to want this to go away. But a story that doesn't match the footage makes things harder. Telling the truth, with a trusted adult beside him, is still the way through." },
            { id: 'r-story', text: 'Agree with the group to all tell the same story.', good: false, response: 'A group story protects the dare, not Darren. He can still step out and tell a parent or another trusted adult what really happened.' },
          ],
        },
      },
    },
    {
      id: 'say-no',
      label: 'Say no, buy it or suggest bubble tea, and walk out together',
      safety: 'safe',
      outcome: {
        title: 'Darren walks out, paid',
        text: 'Darren laughs it off: "Nah. I\'ll just buy it. Bubble tea after? My treat." He pays at the counter. Jia Hui looks relieved and follows him out. Marcus grumbles, then catches up.',
        mood: 'warm',
        effects: { wallet: -4, trust: 2, risk: -1 },
      },
      feedback: {
        tactic: 'loyalty',
        saferMove: 'to turn the dare down lightly, offer the group something else to do, and leave together',
        ifItHappened: "don't help cover it up. Encourage your friend to tell a parent or another trusted adult, and offer to go with them.",
      },
      aftershock: {
        id: 'afterglow-dares-stop',
        polarity: 'protective',
        afterMissions: 1,
        timeLabel: '1 WEEK LATER',
        title: 'Afterglow: the dares stop',
        text: 'In the Sat Squad chat, Jia Hui admits she never wanted to keep watch. Two others say the same. The group swaps dares for a bubble tea taste-test video, and it gets more views than any dare did.',
        effects: { trust: 1 },
      },
    },
  ],
  perspectives: [
    { id: 'p-lead', role: 'Safety Lead', leaning: 'say-no', text: "It's not about the S$4. Taking something without paying is theft, and the video makes it last." },
    { id: 'p-evidence', role: 'Evidence Checker', leaning: 'say-no', text: '"Everyone\'s done it" is one message from Ethan. The only thing we can actually check is the camera notice by the door.' },
    { id: 'p-supporter', role: 'Peer Supporter', leaning: 'look-out', text: "Darren doesn't want to lose his friends. Keeping watch feels like a way to stay in the group without taking anything himself." },
  ],
  peerShield: {
    friend: 'jiahui',
    timeLabel: 'TWO DAYS LATER',
    setup: 'Late at night, Marcus posts the next dare in Sat Squad: Jia Hui, a S$3 keychain, tomorrow after school. She messages Darren privately.',
    messages: [
      { from: 'jiahui', text: "marcus says it's my turn tmr 😬" },
      { from: 'jiahui', text: "if i say no they'll say i'm scared. it's only $3 right" },
      { from: 'jiahui', text: "don't tell the others i asked you ok" },
    ],
    start: { guard: 60, doubt: 30 },
    slots: {
      opener: [
        { id: 'o-glad', text: "Hey, I'm really glad you messaged me.", quality: 'great', why: 'Thanking her for reaching out lowers her guard.', guard: -20, doubt: 5 },
        { id: 'o-think', text: 'Hmm, okay. Let me think.', quality: 'ok', why: 'Calm, but it does not make her feel safe yet.', guard: -5, doubt: 5 },
        { id: 'o-blame', text: 'Seriously? Why would you even think about it?', quality: 'harmful', why: 'Blame makes people defensive and more likely to go along with the group.', guard: 40, doubt: -5 },
      ],
      reason: [
        { id: 'r-gains', text: 'Marcus gets the views, you take all the risk. Store cameras can pick people out days later.', quality: 'great', why: 'Names who gains and what can really happen, without blaming her.', guard: -5, doubt: 25 },
        { id: 'r-vague', text: "It's not a good idea.", quality: 'ok', why: 'True, but vague. She needs a clear reason.', guard: 0, doubt: 10 },
        { id: 'r-fast', text: "Just do it fast and then it's over.", quality: 'harmful', why: 'This pushes her into the same risk, and the next dare will come anyway.', guard: -5, doubt: -20 },
      ],
      offer: [
        { id: 'f-first', text: "Let's both say no in the chat. I'll go first, then bubble tea after school?", quality: 'great', why: 'Going first takes the spotlight off her, and a plan makes "no" easier to say.', guard: -10, doubt: 15 },
        { id: 'f-try', text: 'You could try saying no.', quality: 'ok', why: 'Kind, but it leaves her to face the group alone.', guard: -5, doubt: 5 },
        { id: 'f-watch', text: "I'll keep watch for you so it's quicker.", quality: 'harmful', why: 'This pulls two people into the risk instead of one.', guard: -5, doubt: -15 },
      ],
      channel: [
        { id: 'c-teacher', text: "If Marcus keeps pushing, let's talk to a teacher we trust, together.", quality: 'great', why: 'Points to a trusted adult and offers company for the hard part.', guard: -5, doubt: 15 },
        { id: 'c-mute', text: 'Just mute the chat for a while.', quality: 'ok', why: 'Muting gives her a break, but the pressure will be waiting when she opens it.', guard: 0, doubt: 0 },
        { id: 'c-easier', text: 'Ask Marcus for an easier dare.', quality: 'harmful', why: 'Marcus runs the dares and gains from them. Bargaining keeps her in the game.', guard: 0, doubt: -15 },
      ],
    },
    outcomes: {
      success: 'Jia Hui: "ok... if you say no first, I will too. thanks for not making it weird." In the morning, two "nah, pass" messages appear in Sat Squad.',
      partial: 'Jia Hui: "ok I\'ll think about it." She hasn\'t decided yet. Checking in before school could help.',
      fail: 'Jia Hui: "forget it, you don\'t get it." Seen.',
    },
  },
  ifThen: {
    if: 'friends dare me to take something, or to keep watch while they do',
    then: 'say "nah", suggest something else to do, and walk out together',
  },
  help: ['trusted-adult', 'mindline-1771'],
  sources: [
    { label: 'Mid-Year Crime Brief 2026 (store CCTV and facial recognition)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Triage and pre-court diversionary programmes (Guidance Programme)', publisher: 'Ministry of Social and Family Development', asOf: '2026-10-08' },
    { label: 'Annual Crime Brief 2025 (24 Feb 2026)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
    { label: 'Reasons for rise in youths investigated for shop theft (9 Sep 2026)', publisher: 'Ministry of Home Affairs', asOf: '2026-10-08' },
    { label: 'Shop theft press releases (look-outs)', publisher: 'Singapore Police Force', asOf: '2026-10-08' },
  ],
  review: {
    status: 'draft',
    reviewers: [],
    reviewBy: '2026-12-31',
    notes: 'Drafted from GDD §9.2 and verified sources; needs two human sign-offs (content + safeguarding) before any pilot.',
  },
};
