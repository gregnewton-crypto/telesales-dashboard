/*
 * Telesales micro-training curriculum.
 *
 * Sessions run Monday to Thursday, 15 minutes each, at morning stand-up.
 * One topic per week, four modules per topic.
 *
 * To reorder the programme, move week objects inside PROGRAMME.weeks.
 * Week numbers and calendar dates are derived from array position, so nothing
 * else needs editing.
 *
 * status:  'built'  material exists and is deliverable as-is
 *          'adapt'  material exists but needs condensing to 15 minutes
 *          'create' nothing exists, must be written
 */

const BANK_HOLIDAYS = {
  '2026-08-31': 'Summer bank holiday',
  '2026-12-25': 'Christmas Day',
  '2026-12-28': 'Boxing Day (substitute)',
  '2027-01-01': 'New Year\u2019s Day',
  '2027-04-02': 'Good Friday',
  '2027-04-05': 'Easter Monday',
  '2027-05-03': 'Early May bank holiday',
  '2027-05-31': 'Spring bank holiday',
  '2027-08-30': 'Summer bank holiday'
};

const STATUS_LABELS = {
  built: {
    short: 'Built',
    name: 'Built \u2014 run as is',
    blurb: 'The material already exists in this repository and is deliverable. Cut it to 15 minutes and go.'
  },
  adapt: {
    short: 'Adapt',
    name: 'Adapt \u2014 condense existing',
    blurb: 'Content exists but was written for a longer session or a different audience. Needs reshaping, not writing.'
  },
  create: {
    short: 'New',
    name: 'New \u2014 write from scratch',
    blurb: 'Nothing covers this today. The module needs authoring before it can run.'
  }
};

const PROGRAMME = {
  title: 'Telesales Micro-Training',
  startMonday: '2026-08-24',
  days: ['Mon', 'Tue', 'Wed', 'Thu'],
  weeks: [
    {
      topic: 'SPH \u2014 Sales Per Hour',
      short: 'SPH',
      colour: 'coral',
      outcome: 'Every agent knows their own SPH, can name the three levers behind it, and has picked one to work on.',
      days: [
        {
          title: 'Know your number',
          status: 'create',
          objective: 'Every agent can say the SPH formula out loud and knows their own SPH from last week.',
          hook: 'Two agents, same leads, same six hours on the phones. One books nine sales, one books four. That gap is not luck \u2014 it is three numbers, and you control all three.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read out the two-agent gap. Then ask the room: who can tell me their own SPH right now, without looking?' },
            { time: '2\u20137', label: 'Teach', detail: 'SPH is sales divided by hours on the phones. Then break it open: SPH = calls per hour \u00d7 connect rate \u00d7 contact conversion. Show the SPH and CPH tiles on the dashboard.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone opens the dashboard and writes down four of their own numbers from last week: SPH, CPH, connect rate, contact conversion. Circle the weakest one.' },
            { time: '12\u201315', label: 'Commit', detail: 'Round the room, one sentence each: \u201cMy SPH is ___, my weakest lever is ___.\u201d No targets today.' }
          ],
          metric: 'SPH (Sales/Hr) \u2014 Telesales Dashboard, Daily tab',
          coach: 'Do not set targets in this session. If you set a target before they own the number, they spend the week arguing with the number instead of working on it.',
          gap: 'Needs a printed one-page SPH card per agent with their last four weeks pulled off the dashboard before Monday morning.',
          sources: [{ label: 'Telesales Dashboard \u2014 Daily tab', href: 'index.html' }]
        },
        {
          title: 'Lever one: more conversations an hour',
          status: 'create',
          objective: 'Cut dead time between calls. Every agent leaves with one change to their between-call routine.',
          hook: 'Talk time is the number we divide by. Calls per hour is the only lever that is entirely in your hands before the customer even picks up.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Twenty calls a day, forty-five seconds of dead time each. That is fifteen minutes of talk time gone before you have done anything wrong.' },
            { time: '2\u20136', label: 'Teach', detail: 'The three dead-time killers: writing notes after the call instead of during it, deciding who to call next, and re-reading the lead from scratch. Each costs 30 to 60 seconds.' },
            { time: '6\u201311', label: 'Drill', detail: 'In pairs, describe your between-call ritual step by step while your partner times it. Find the thirty seconds you can take out.' },
            { time: '11\u201315', label: 'Commit', detail: 'One change each, said out loud: notes typed while the customer is talking, disposition decided before you hang up, next lead already queued.' }
          ],
          metric: 'CPH (Calls/Hr) \u2014 watch it tomorrow, not next month',
          coach: 'Confirm the Adversus disposition shortcuts with Greg before running this. The whole module falls apart if the tooling advice is wrong.',
          gap: 'Needs the current Adversus disposition and quick-key list. The onboarding Day 2 systems session already covers Adversus, so pull it from there rather than starting fresh.',
          sources: [{ label: 'Onboarding \u2014 Day 2: Hands On With the Systems', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Lever two: talk time that pays',
          status: 'create',
          objective: 'Every agent can spot the moment a call stopped being a sale, and can close it warmly instead of talking on.',
          hook: 'A twenty-two minute call to a no is two eleven-minute calls you never made.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Talk Time Hours is the denominator in SPH. Long calls do not just fail \u2014 they cost you the next call too.' },
            { time: '2\u20136', label: 'Teach', detail: 'Three outcomes, three exits. A yes: close and set expectations. A real maybe: book a callback at a named time. A no: disposition it cleanly and go. The two-no rule \u2014 two genuine no-signals with no new information means the call is over.' },
            { time: '6\u201312', label: 'Drill', detail: 'Play one recorded long call that did not convert. Everyone writes down the minute it should have ended. Compare answers \u2014 they will cluster.' },
            { time: '12\u201315', label: 'Commit', detail: 'Today, book the callback instead of talking on. Watch your calls per hour after lunch, which is where it usually slides.' }
          ],
          metric: 'Talk Time Hrs against Sales \u2014 Daily tab',
          coach: 'Pull the long call from last week and clip it. Do not use a call from anyone sitting in the room.',
          gap: 'Needs one recorded long non-converting call selected and clipped. Call listening is already a routine from onboarding Day 2, so the process exists.',
          sources: [{ label: 'Onboarding \u2014 Day 2: Call Listening', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'The SPH that actually counts',
          status: 'create',
          objective: 'Every agent understands that a sale which pauses before the box lands was never a sale, and picks one lever target for the week.',
          hook: 'Across the team, 4.1% of sales pause before the first box is even delivered. Rep by rep that runs from 1.8% to 8.8% \u2014 a fivefold spread on the same product and the same leads.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The 1.8% to 8.8% spread. Name nobody. The range is the lesson.' },
            { time: '3\u20138', label: 'Teach', detail: 'Gross SPH versus retained SPH. Six in ten of those pre-delivery pauses say \u201cdo not want subscription\u201d \u2014 that is an expectation we set on the call, not a product fault. Commission is moving to valid sale, second payment, 28 days, 84 days. Fast and sloppy stops paying.' },
            { time: '8\u201312', label: 'Drill', detail: 'Each agent picks one lever, one number and one behaviour for the week. Write it down, not just say it.' },
            { time: '12\u201315', label: 'Commit', detail: 'Onto the whiteboard. Monday\u2019s stand-up opens by reading these back.' }
          ],
          metric: 'Pre-delivery pause rate by rep \u2014 team average 4.1%',
          coach: 'Keep this non-punitive or you will lose the room. The spread is the point, not the league table.',
          sources: [
            { label: 'Pause Tracker \u2014 pre-delivery pauses and rep league', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Retention Data Plan \u2014 Stage 5: commission model', href: 'd2ms-retention-data-plan.html' }
          ]
        }
      ]
    },
    {
      topic: 'Customer Needs Discovery',
      short: 'Discovery',
      colour: 'blue',
      outcome: 'Every agent captures the four facts that predict retention, and plays them back before pitching.',
      days: [
        {
          title: 'The four things we never end a call without',
          status: 'adapt',
          objective: 'Every agent asks and logs all four discovery facts on every call.',
          hook: 'Forty per cent of every pause we get says \u201cpet did not eat the food\u201d. Most of that is decided by what we learn in the first three minutes of the call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The 40%. Say it plainly: our biggest churn reason is set on our call, before the food ever ships.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four. One: what is she eating right now \u2014 dry, wet, raw or mixed, and the brand if they know it. Two: easy, normal or fussy. Three: the household \u2014 how many cats, who feeds her, what the routine is. Four: what made you look at us today. Every one of them changes something we do later.' },
            { time: '7\u201312', label: 'Drill', detail: 'Pairs, ninety seconds each way. Get all four without it sounding like a form.' },
            { time: '12\u201315', label: 'Commit', detail: 'All four in the notes on every sale today. Nothing else changes this week.' }
          ],
          metric: 'Completion rate on Eater Type and previous-food fields',
          coach: 'These fields already exist in the export. This module is about filling them properly, not adding anything new.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section E', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 required capture fields', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Asking without interrogating',
          status: 'create',
          objective: 'Turn four questions into a conversation the customer actually enjoys.',
          hook: 'Four questions in a row is a form. Four questions with a follow-up each is a conversation.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read two versions of the same discovery out loud \u2014 one as a checklist, one as a chat. Same four facts, completely different call.' },
            { time: '2\u20136', label: 'Teach', detail: 'Permission phrasing: \u201cso I get her first box right, can I ask\u2026\u201d. The one follow-up that does all the work: \u201cand how\u2019s that going?\u201d. And the rule: never two questions in one breath.' },
            { time: '6\u201312', label: 'Drill', detail: 'Worst-case role play. One of you is the customer who answers everything in one word. Two minutes each way.' },
            { time: '12\u201315', label: 'Commit', detail: 'Use \u201cand how\u2019s that going?\u201d at least three times today and notice what it opens up.' }
          ],
          metric: 'Discovery depth on QA-scored calls',
          coach: 'The one-word customer is the whole exercise. Coach the follow-up, not the question list.'
        },
        {
          title: 'Hearing the reason and the risk in one sentence',
          status: 'create',
          objective: 'Every agent can name the buying motive and the retention risk from a single customer answer.',
          hook: '\u201cShe\u2019s a bit fussy\u201d is a reason to buy and a warning light at the same time. Cats flagged fussy are 3.37% more likely to pause.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The fussy line. Two meanings, one sentence.' },
            { time: '2\u20137', label: 'Teach', detail: 'Three motives: health worry, fussiness and food boredom, convenience. Three risk flags: currently on kibble (the longest switch there is), flagged fussy (add a week), and wants one recipe only (1.6% of customers, and the worst retention of any group).' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer reads six real customer lines. The team calls the motive and the flag for each. Fast, no debate.' },
            { time: '12\u201315', label: 'Commit', detail: 'When you hear a flag, say the plan out loud before you close. Do not save it for the notes.' }
          ],
          metric: 'Early pause rate for sales flagged fussy at point of sale',
          sources: [
            { label: 'Pause Tracker \u2014 fussy premium and recipe variety', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 transition tracks', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Play it back, then write it down',
          status: 'adapt',
          objective: 'Every agent can recap needs in twenty seconds and leave a note the retention team can act on.',
          hook: 'If you can play it back, they know you listened. If you write it down, the next person can pick up where you left off.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a real note that tells the next person nothing, then one that tells them everything.' },
            { time: '2\u20137', label: 'Teach', detail: 'The twenty-second recap: \u201cSo she\u2019s on kibble, a bit picky, one cat, and you\u2019re mainly worried about her weight. Here\u2019s what I\u2019d do.\u201d Then the note standard: previous food, eating type, recipes chosen, portion, and anything they told you about the household.' },
            { time: '7\u201312', label: 'Drill', detail: 'Recap drill. Trainer reads out a set of mock notes, agent delivers the twenty-second recap from them.' },
            { time: '12\u201315', label: 'Commit', detail: 'Recap out loud before every close today. It costs twenty seconds and it changes the close.' }
          ],
          metric: 'Note quality on the retention QA scorecard',
          coach: 'The read-back pattern is already written in the Transition deck for the tasting card. Reuse the shape.',
          sources: [
            { label: 'Transition & Texture deck \u2014 scorecard read-back', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 structured reason capture', href: 'retention-improvement-master-plan.html' }
          ]
        }
      ]
    },
    {
      topic: 'Product & Food Variants',
      short: 'Product',
      colour: 'teal',
      outcome: 'Every agent can describe the range, set the right portion, name textures and build a wider box.',
      days: [
        {
          title: 'The range in sixty seconds',
          status: 'adapt',
          objective: 'Every agent can describe the range \u2014 recipes, textures, tray sizes, cadence \u2014 in under a minute with no notes.',
          hook: 'If it takes you two minutes to explain what they are buying, you have already lost the call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask one agent to explain the range cold. Time it. It will be too long, and that is the lesson.' },
            { time: '2\u20137', label: 'Teach', detail: 'What the food is and how it is made, the recipes, two textures in every tray, tray sizes, delivery cadence. Then the one-breath version that keeps only what is a reason to buy.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers the sixty-second range out loud, timed. Cut anything that is not a reason to buy.' },
            { time: '12\u201315', label: 'Commit', detail: 'Short version only today. Stop explaining, start matching.' }
          ],
          metric: 'Average handling time on the presentation beat',
          coach: 'Do not run this until the product facts are signed off. Agents delivering confident wrong facts is worse than nothing.',
          gap: 'Blocked pending facts. The recipe list, tray sizes and cadence options are not written down anywhere in this repository, and the retention copy review flags product variants as an unresolved author query. Needs a confirmed one-page product fact sheet.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section B: the science', href: 'transition-texture-training-deck.html' },
            { label: 'Copy Review \u2014 slide 16 \u201cOur flavours\u201d (flagged for confirmation)', href: 'retention-training-copy-review.html' }
          ]
        },
        {
          title: 'Portions: four bands cover almost everyone',
          status: 'create',
          objective: 'Every agent can set the right portion on the call and say it in grams and in meals.',
          hook: 'We run 42 feeding segments in Looker. But 92.1% of cats land in just four bands: 65g, 90g, 130g and 180g.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Forty-two segments, four that matter. Complexity on our side does not have to reach the customer.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four bands. Then how to say it so it lands: \u201cshe\u2019s 90g a day, so that\u2019s one tray split into two meals\u201d. Grams alone means nothing to them; meals do.' },
            { time: '7\u201311', label: 'Drill', detail: 'Four quick scenarios. Call the band, then say the line in grams and in meals.' },
            { time: '11\u201315', label: 'Commit', detail: 'State the portion both ways on every sale today. 3.4% of our pauses say we are too inconvenient, and that is usually a portion set wrong on our call.' }
          ],
          metric: 'Share of pauses citing inconvenience \u2014 currently 3.4%',
          sources: [
            { label: 'Master Plan \u2014 grams-per-day segments', href: 'retention-improvement-master-plan.html' },
            { label: 'Pause Tracker \u2014 inconvenience pauses', href: 'd2ms-retention-pause-tracker.html' }
          ]
        },
        {
          title: 'Texture is what she actually tastes',
          status: 'built',
          objective: 'Every agent matches the first serve to what the cat eats now, using texture language that is specific.',
          hook: 'Cats do not read the recipe name. They meet a texture.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line. Then ask: when you describe the food, do you name the recipe or the texture?' },
            { time: '2\u20137', label: 'Teach', detail: 'Two textures in every tray. The texture ladder from what she eats now to what we send. Vague language versus specific language. Match the first serve to her current food.' },
            { time: '7\u201312', label: 'Drill', detail: '\u201cSay this, not that\u201d \u2014 six pairs. Read the weak line, then the strong one. Hearing both is the exercise.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name the texture, not just the recipe, on every call today.' }
          ],
          metric: 'Texture match rate on first serve',
          coach: 'Straight lift from the Transition & Texture deck, Section D. Slides and speaker notes exist \u2014 take slides 15 to 19 and cut to one idea.',
          sources: [{ label: 'Transition & Texture deck \u2014 Section D: Texture nuance', href: 'transition-texture-training-deck.html' }]
        },
        {
          title: 'Variety sells and variety keeps',
          status: 'create',
          objective: 'Every agent builds a wider box and can say why in one sentence.',
          hook: 'Customers who take all seven recipes retain at 56.4% at 28 days. Four recipes retains at 46.7%. Our average is 4.53.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read the two numbers. Nearly ten points of retention sits between a narrow box and a wide one.' },
            { time: '2\u20137', label: 'Teach', detail: 'The variety curve. Only 1.6% take a single recipe and they churn hardest of all. How to widen the box without lengthening the call: \u201cI\u2019ll put a spread in so she\u2019s got options, and you can swap any of them free in the first month.\u201d' },
            { time: '7\u201312', label: 'Drill', detail: 'Take a mock order with two recipes on it. Widen it out loud, in one sentence, without sounding like an upsell.' },
            { time: '12\u201315', label: 'Commit', detail: 'No box goes out with fewer than four recipes today unless the customer genuinely insists.' }
          ],
          metric: 'Average distinct recipes per subscription \u2014 currently 4.53',
          sources: [{ label: 'Pause Tracker \u2014 recipe variety against retention', href: 'd2ms-retention-pause-tracker.html' }]
        }
      ]
    },
    {
      topic: 'Conversion Training',
      short: 'Conversion',
      colour: 'green',
      outcome: 'Every agent runs a structured call, matches instead of lists, asks directly, and handles the subscription objection honestly.',
      days: [
        {
          title: 'Structure beats script',
          status: 'adapt',
          objective: 'Every agent can name the five beats of our call and say which one they personally rush.',
          hook: 'You do not need a script. You need to always know which beat you are in.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask the room to name the five beats. Whatever comes back tells you where to spend the next five minutes.' },
            { time: '2\u20137', label: 'Teach', detail: 'Open, discover, present, handle, close. What each beat is for and what it hands to the next one. The most common failure is jumping straight from open to present and skipping discovery entirely.' },
            { time: '7\u201312', label: 'Drill', detail: 'Play a two-minute call opening. The team calls the beats out loud as they happen.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name your beat in your head on every call today. That is all.' }
          ],
          metric: 'Contact conversion rate \u2014 dashboard, Contact CVR',
          coach: 'The pitch structure is already taught on onboarding Day 1. This is a refresher for the whole team, not new doctrine.',
          sources: [{ label: 'Onboarding \u2014 Day 1: The Pitch', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Match, don\u2019t list',
          status: 'create',
          objective: 'Every agent presents three things maximum, each tied to something the customer actually said.',
          hook: 'Nine features is not nine reasons to buy. It is nine chances to say something they do not care about.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a nine-feature pitch out loud at speed. Ask what they remember. They will remember almost none of it.' },
            { time: '2\u20137', label: 'Teach', detail: 'The match rule: every feature must attach to a need you heard in discovery. Three is the ceiling. The sentence shape is \u201cyou said ___, so ___, which means ___ for her\u201d.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer gives three discovery facts. Agent builds the three-feature match on the spot, out loud, no preparation.' },
            { time: '12\u201315', label: 'Commit', detail: 'Three features today, each one attached to something they told you. Count them on your fingers if you have to.' }
          ],
          metric: 'Contact conversion rate',
          coach: 'If an agent cannot attach a feature to a need, that is a discovery problem showing up in the presentation. Send them back to last week.'
        },
        {
          title: 'Asking for the sale',
          status: 'create',
          objective: 'Every agent asks for the sale directly and defaults to recommending the 14-day trial box.',
          hook: 'The 14-day trial box early-pauses at 19.7%. The 7-day box early-pauses at 27.2%. Trial box length is the strongest single driver in the whole dataset.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The two numbers, and the fact that 28-day retention is essentially identical between them. The 14-day box buys the transition time to actually work.' },
            { time: '3\u20138', label: 'Teach', detail: 'The assumptive close and the two-option close. Why we lead with 14 days. And then the hardest part: ask, and be quiet.' },
            { time: '8\u201313', label: 'Drill', detail: 'Closing round. Everyone delivers their close out loud, once, then stops talking. The silence is the exercise, not the words.' },
            { time: '13\u201315', label: 'Commit', detail: 'Recommend 14 days first on every call today.' }
          ],
          metric: 'Trial box mix, and early pause rate by trial length',
          coach: 'Confirm with Ed that 14-day is the commercial default before running this. The retention data says yes; the margin call is his.',
          gap: 'Trial length is listed as an open decision in the master plan. Get a yes or no before this module goes live, or agents will get contradicted.',
          sources: [{ label: 'Pause Tracker \u2014 trial box duration comparison', href: 'd2ms-retention-pause-tracker.html' }]
        },
        {
          title: '\u201cI don\u2019t want a subscription\u201d',
          status: 'create',
          objective: 'Every agent can handle the subscription objection honestly, without overpromising flexibility we do not have.',
          hook: '21.5% of all pauses say \u201cdo not want subscription\u201d. Among customers who pause before the box even arrives, it is 60%.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The 60%. These people said yes to us and changed their mind in the quiet afterwards. That is our call, not the product.' },
            { time: '3\u20138', label: 'Teach', detail: 'This is a commitment worry, not a price worry. Name the flexibility precisely \u2014 skip, pause, change recipes, move the date \u2014 and never round it up into \u201ccancel any time\u201d if that is not exactly true.' },
            { time: '8\u201313', label: 'Drill', detail: 'Role play: enthusiastic customer who then asks \u201cso is this a contract?\u201d. Two minutes each way.' },
            { time: '13\u201315', label: 'Commit', detail: 'Say the flexibility in specific terms on every sale today. Specific beats generous.' }
          ],
          metric: 'Pre-delivery pause rate \u2014 currently 4.1% of sales',
          gap: 'Needs the exact signed-off flexibility wording: what we can truthfully promise on skip, pause and cancel. This is the highest-value line in the whole curriculum and it has to be legally clean before anyone says it on a call.',
          sources: [
            { label: 'Pause Tracker \u2014 pause reason mix and pre-delivery breakdown', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Copy Review \u2014 slide 04: subscription versus acceptance', href: 'retention-training-copy-review.html' }
          ]
        }
      ]
    },
    {
      topic: 'Pricing, Value & Cost Objections',
      short: 'Pricing',
      colour: 'purple',
      outcome: 'Every agent states price without flinching, reframes to cost per day, has an answer for the five objections, and never discounts to fix a food problem.',
      days: [
        {
          title: 'Know the numbers cold',
          status: 'create',
          objective: 'Every agent can state the price per day for a typical cat without looking it up.',
          hook: 'If you hesitate on price, you have told them it is too much before they have decided for themselves.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask three agents for the price of a 90g cat. Any hesitation proves the point.' },
            { time: '2\u20137', label: 'Teach', detail: 'Price by portion band. Price per day. What the acquisition discount is and exactly which week it steps down. Say it flat \u2014 no apology, no rushing past it.' },
            { time: '7\u201312', label: 'Drill', detail: 'Rapid fire. Trainer calls a portion band, agent states the box price and the price per day. Round the room twice.' },
            { time: '12\u201315', label: 'Commit', detail: 'No hesitating on price today. State it, then stop talking.' }
          ],
          metric: 'Objection rate on price at the presentation beat',
          gap: 'Blocked. There is no price list anywhere in this repository. Needs current prices by portion band, the acquisition discount amount, and the exact week it steps down. This module cannot run without it.'
        },
        {
          title: 'Cost per day, not cost per box',
          status: 'create',
          objective: 'Every agent reframes price into a daily number and a comparison the customer already understands.',
          hook: 'A box price is a number they have to judge. A daily price is a number they can compare to something they already buy.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Say the box price, then the daily price. Same money, completely different reaction.' },
            { time: '2\u20137', label: 'Teach', detail: 'The daily reframe. Compare to what they spend now, not to a competitor. And never compete on price alone when the reason they called was that the cat is not eating.' },
            { time: '7\u201312', label: 'Drill', detail: 'Three price objections, three daily reframes, out loud, no notes.' },
            { time: '12\u201315', label: 'Commit', detail: 'Give the daily number before they ask for it.' }
          ],
          metric: 'Contact conversion rate on calls where price came up first',
          gap: 'Depends on Monday\u2019s price sheet.'
        },
        {
          title: 'The five price objections',
          status: 'create',
          objective: 'Every agent has a first sentence ready for each of the five price objections we actually get.',
          hook: 'Price is 21.4% of all our pauses \u2014 but it barely shows up in the first week. Price is a week-seven problem that we create on day one by not pre-selling the step-down.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'Price is under-represented in early churn and over-represented later. That timing tells you exactly when to deal with it: now, on the first call.' },
            { time: '3\u20138', label: 'Teach', detail: 'The five: it is too expensive; I can get it cheaper elsewhere; I will think about it; what happens when the discount ends; can you do better. One first sentence each. The rule for number four \u2014 tell them the step-down before they find it.' },
            { time: '8\u201313', label: 'Drill', detail: 'Objection round-robin. Trainer throws one, agent answers in a single sentence, straight on to the next person.' },
            { time: '13\u201315', label: 'Commit', detail: 'Pre-empt the discount step-down on every sale today.' }
          ],
          metric: 'Share of pauses citing price \u2014 currently 21.4%',
          sources: [
            { label: 'Pause Tracker \u2014 price is 21.4% of pauses, under-represented early', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 the week seven price cliff', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Never discount to fix a food problem',
          status: 'built',
          objective: 'Every agent uses the offer ladder instead of money in the first 28 days.',
          hook: 'A discount will not make her eat it. Money does not fix a food problem \u2014 it just makes the same problem cheaper.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line, said once. It does most of the work on its own.' },
            { time: '2\u20137', label: 'Teach', detail: 'The offer ladder: free recipe swap, texture swap, rescue kit, portion reset, delivery date shift, transition clinic. No discounts inside 28 days \u2014 that is a rule, not a preference. Then the replacement line for when they push.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play: customer asks for money on day six because the cat is not eating. Get to a swap without getting defensive.' },
            { time: '12\u201315', label: 'Commit', detail: 'Zero discounts inside 28 days this week. Log what you offered instead \u2014 that log is the data we are missing.' }
          ],
          metric: 'Swap-to-pause ratio',
          coach: 'Lift Section G of the Transition & Texture deck wholesale. The offer ladder and the replacement line are already written and tested.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section G: Swap, don\u2019t stop', href: 'transition-texture-training-deck.html' },
            { label: 'First 72 Hours \u2014 the offer ladder', href: 'first-72-hours-programme.html' },
            { label: 'Master Plan \u2014 guardrail: no discounting inside 28 days', href: 'retention-improvement-master-plan.html' }
          ]
        }
      ]
    },
    {
      topic: 'Demographics & Personas',
      short: 'Personas',
      colour: 'rust',
      outcome: 'Every agent can place a customer into a working profile in the first minute and adapt the opening without changing the facts.',
      days: [
        {
          title: 'What we actually know about our customers',
          status: 'create',
          objective: 'Every agent knows which customer facts we hold, which we do not, and which ones predict retention.',
          hook: 'We know her eater type, her weight and her postcode. We do not know the owner\u2019s age or income. So our personas have to be built out of behaviour, not guesses.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'What we hold versus what we imagine we hold. Personas built on invention get contradicted on live calls.' },
            { time: '2\u20137', label: 'Teach', detail: 'The fields we capture: eater type, body type, breed, age in months, weight, activity level, postcode, pouch size, cadence, trial length, recipe count. Which actually move retention: trial length, recipe variety, eater type. Which does not: breed, which shows no meaningful signal at all.' },
            { time: '7\u201312', label: 'Drill', detail: 'Guess then check. The team votes on the strongest driver. Reveal that it is trial box duration.' },
            { time: '12\u201315', label: 'Commit', detail: 'Stop using breed as a talking point. Use previous food and eater type instead.' }
          ],
          metric: 'Field completeness on eater type and previous food',
          sources: [
            { label: 'Pause Tracker \u2014 field audit and driver cuts', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 breed shows no meaningful signal', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Four working profiles',
          status: 'create',
          objective: 'Every agent can place a customer into one of four profiles inside the first minute.',
          hook: 'You are not adapting the product. You are adapting the first thirty seconds.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Same product, four different first thirty seconds. That is all a persona is for.' },
            { time: '2\u20138', label: 'Teach', detail: 'Four draft profiles built from what we capture. The Worried Owner: health-led, older cat, wants reassurance and evidence. The Fussy-Cat Veteran: has tried everything, flagged fussy, needs the honest transition story. The Convenience Household: multi-cat, cadence-sensitive, highest inconvenience-pause risk. The Kitten Starter: young cat, habits still forming, longest life if we get box one right.' },
            { time: '8\u201312', label: 'Drill', detail: 'Four one-line customer intros. The team calls the profile for each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name the profile in your notes on every sale today.' }
          ],
          metric: 'Early pause rate cut by profile, once we start tagging',
          gap: 'These four profiles are drafts written from the export fields, not the output of a segmentation study. Validate before they go on the wall: a cut of early pause rate by eater type, cat age band and household cat count would confirm or kill them.'
        },
        {
          title: 'Multi-cat and household reality',
          status: 'create',
          objective: 'Every agent can set portions, cadence and delivery for a household rather than for a single cat.',
          hook: 'The person who feeds her is not always the person on the phone.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line. Then ask how many of them routinely ask who does the feeding. It will be very few.' },
            { time: '2\u20137', label: 'Teach', detail: 'How many cats and who eats what. Portions when two cats share. Cadence against fridge and freezer space. Delivery day and who is actually home. This is where inconvenience pauses get prevented.' },
            { time: '7\u201312', label: 'Drill', detail: 'Two-cat scenario worked out loud: portions, trays, cadence, delivery day. All four, no gaps.' },
            { time: '12\u201315', label: 'Commit', detail: 'Ask who feeds her on every call today.' }
          ],
          metric: 'Share of pauses citing inconvenience \u2014 currently 3.4%'
        },
        {
          title: 'Same facts, different opening',
          status: 'create',
          objective: 'Every agent has a tailored opening for each of the four profiles, using identical product facts.',
          hook: 'Four customers, four openings, one truth. Changing the facts is not tailoring \u2014 it is overpromising.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Tailoring versus embellishing. Where the line sits, and why crossing it shows up as a pause six weeks later.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four openings. The one proof point each profile needs. And the claims we never make regardless of who we are talking to.' },
            { time: '7\u201312', label: 'Drill', detail: 'Same discovery facts delivered four ways round the room. Everyone hears all four.' },
            { time: '12\u201315', label: 'Commit', detail: 'Pick your opening deliberately today rather than defaulting to the one you always use.' }
          ],
          metric: 'QA score on overpromising',
          coach: 'The promises and never-promise list already exists in the Transition deck. Use it verbatim so the boundary is identical across both programmes.',
          sources: [{ label: 'Transition & Texture deck \u2014 promises and never-promise', href: 'transition-texture-training-deck.html' }]
        }
      ]
    },
    {
      topic: 'Retention & Churn Prevention',
      short: 'Retention',
      colour: 'brown',
      outcome: 'Every agent sets a truthful transition expectation, delivers the mechanics, and turns a pause request into a swap.',
      days: [
        {
          title: 'Where we actually lose customers',
          status: 'adapt',
          objective: 'Every agent can state where and when churn happens, from real numbers rather than instinct.',
          hook: '24.2% of our sales pause inside the first seven days. Nearly a third of every pause we ever get happens in the first six days. The single biggest day is day five.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The three numbers. Then the median: nine days to first pause. Not months. Days.' },
            { time: '3\u20138', label: 'Teach', detail: 'The shape of churn: the early cliff, the day-five peak, then a second wave at week seven when the discount steps down. The reason mix: did not eat 40%, do not want subscription 21.5%, price 21.4%. Almost all of it is decided before the box is opened.' },
            { time: '8\u201313', label: 'Drill', detail: 'Predict then reveal. The team ranks the pause reasons on the board, then sees the real order. The gap between the two is the discussion.' },
            { time: '13\u201315', label: 'Commit', detail: 'Nothing behavioural today. Today is about knowing the battlefield before we fight on it.' }
          ],
          metric: 'Early pause rate under seven days \u2014 currently 24.2%',
          coach: 'Use the audited figures from the pause tracker, which are reproducible from the audit script. Avoid the older headline percentages floating around in the decks \u2014 the denominators differ and someone will spot it.',
          sources: [
            { label: 'Pause Tracker \u2014 all figures', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 the evidence we are building on', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Promise the process, not the outcome',
          status: 'built',
          objective: 'Every agent sets a truthful transition expectation matched to the cat\u2019s current food.',
          hook: '\u201cShe\u2019ll love it\u201d is the most expensive sentence on the call. It sets a finish line we cannot control.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The sentence, and what it costs. We are not selling a verdict, we are setting up a trial.' },
            { time: '2\u20137', label: 'Teach', detail: 'The transition tracks. Kibble takes 14 days and can run to three or four weeks. Wet is 7 to 10 days. Raw is 3 to 7. Mixed feeding is 10 to 14. If she is flagged fussy, add a week. Say the number on the call.' },
            { time: '7\u201312', label: 'Drill', detail: 'Four cats, four previous foods. Say the transition line for each, out loud, with the number in it.' },
            { time: '12\u201315', label: 'Commit', detail: 'State the transition window on every sale today. Promise the process and our support, never the cat\u2019s verdict.' }
          ],
          metric: 'Share of early pauses citing food refusal \u2014 currently 36.4%',
          coach: 'Section E of the Transition & Texture deck. The tracks table is already written and already mirrored in the master plan, so the numbers agree.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section E: Transition tracks', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 transition tracks table', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'The mechanics you must say out loud',
          status: 'built',
          objective: 'Every agent can deliver the six transition mechanics in thirty seconds without missing one.',
          hook: 'Six instructions. Miss one and the first bowl can fail for a reason that has nothing to do with the food.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask for the six from memory. Count how many come back. It will not be six.' },
            { time: '2\u20137', label: 'Teach', detail: 'Warm the food. Clean plate. Old food and treats removed between meals. Start with chicken because it is easiest on the stomach. Twenty minutes, then take it away. Introduce a second recipe only once one is settled.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers all six in thirty seconds while their partner ticks them off. Anyone who misses one goes again.' },
            { time: '12\u201315', label: 'Commit', detail: 'All six on every sale today. If you have not said them, you have not finished the call.' }
          ],
          metric: 'Warm-serve adoption, and first meal logged within 48 hours',
          coach: 'Already written in both the Transition deck and the master plan. This one is pure repetition \u2014 run it again in a month.',
          sources: [
            { label: 'Transition & Texture deck \u2014 the three mechanics', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 transition mechanics', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Swap, don\u2019t stop',
          status: 'built',
          objective: 'Every agent can turn a pause request into a swap, and knows where the full certification sits.',
          hook: 'The number we are chasing is the swap-to-pause ratio. Every swap is a customer who stayed.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Swap-to-pause as the signature metric. A pause is a decision; a swap is another chance.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four calls you will get this week: she will not touch it; she ate it twice then stopped; it made her sick; I want to pause. The first move for each. Then the Fussy Cat Promise \u2014 unlimited free recipe and texture swaps in the first 28 days, and Box 2 rebuilt free if Box 1 fails completely.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play brief A from the deck: day-two refusal, kibble-fed fussy cat.' },
            { time: '12\u201315', label: 'Commit', detail: 'Book the full 90-minute Transition & Texture certification. This week was the trailer.' }
          ],
          metric: 'Swap-to-pause ratio, and certification coverage across the team',
          coach: 'Everything here exists: four common calls, the offer ladder, role-play briefs A, B and C, and a twelve-question assessment. Treat this session as the hand-off into that certification rather than a replacement for it.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Sections G and H', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 the Fussy Cat Promise', href: 'retention-improvement-master-plan.html' },
            { label: 'First 72 Hours \u2014 swap-to-pause ratio', href: 'first-72-hours-programme.html' }
          ]
        }
      ]
    }
  ]
};

/*
 * Short labels for the chart blocks. A day column is too narrow for a full
 * lesson title, and a truncated title is worse than a short one. Full titles
 * stay on the week cards and in the lesson plan.
 */
const CHART_LABELS = {
  w1d1: 'Your number',
  w1d2: 'More calls an hour',
  w1d3: 'Talk time that pays',
  w1d4: 'SPH that counts',

  w2d1: 'The four facts',
  w2d2: 'Ask, don\u2019t quiz',
  w2d3: 'Reason and risk',
  w2d4: 'Play it back',

  w3d1: 'Range in 60 seconds',
  w3d2: 'Four portion bands',
  w3d3: 'Texture, not recipe',
  w3d4: 'Variety sells',

  w4d1: 'The five beats',
  w4d2: 'Match, don\u2019t list',
  w4d3: 'Ask for the sale',
  w4d4: 'The contract question',

  w5d1: 'Numbers cold',
  w5d2: 'Cost per day',
  w5d3: 'Five answers ready',
  w5d4: 'Never discount',

  w6d1: 'What we know',
  w6d2: 'Four profiles',
  w6d3: 'Who feeds her',
  w6d4: 'Four openings',

  w7d1: 'Where we lose them',
  w7d2: 'Promise the process',
  w7d3: 'The six rules',
  w7d4: 'Swap, don\u2019t stop'
};

const OPEN_QUESTIONS = [
  {
    week: 'Week 3 \u2014 Product',
    blocker: true,
    question: 'Is there a current product fact sheet \u2014 the recipe list, tray sizes, textures per tray and cadence options?',
    why: 'Nothing in this repository states the range, and the retention copy review already flags product variants as an unresolved author query. Week 3 Monday cannot run on guesses.'
  },
  {
    week: 'Week 5 \u2014 Pricing',
    blocker: true,
    question: 'What are the current prices by portion band, what is the acquisition discount, and exactly which week does it step down?',
    why: 'There is no price list anywhere in the repository. Three of the four pricing modules depend on it. This is the single biggest blocker in the curriculum.'
  },
  {
    week: 'Week 4 \u2014 Conversion',
    blocker: true,
    question: 'What is the exact, signed-off wording for skip, pause and cancel flexibility?',
    why: '60% of pre-delivery pauses say they did not want a subscription. Agents are already answering this question on calls, and if the wording is not agreed then it is being improvised.'
  },
  {
    week: 'Week 4 \u2014 Conversion',
    question: 'Is the 14-day trial box the commercial default, or is 7-day still preferred for margin reasons?',
    why: 'The 14-day box early-pauses at 19.7% against 27.2% for the 7-day, with near-identical 28-day retention. Trial length is still listed as an open decision in the master plan, so this needs a yes or no before Week 4 Wednesday.'
  },
  {
    week: 'Week 1 \u2014 SPH',
    question: 'Can we get per-agent SPH, CPH, connect rate and contact conversion for the last four weeks as a printable card?',
    why: 'Week 1 Monday is built around each agent reading their own numbers. Without the card the session becomes a lecture about a formula.'
  },
  {
    week: 'Week 1 \u2014 SPH',
    question: 'Are the Adversus disposition shortcuts documented anywhere, and who owns that list?',
    why: 'Week 1 Tuesday tells agents to change their between-call routine. If the tooling advice is wrong the whole module loses credibility.'
  },
  {
    week: 'Week 6 \u2014 Personas',
    question: 'Has anyone cut early pause rate by eater type, cat age band and household cat count?',
    why: 'The four profiles in Week 6 are drafted from export fields, not from a segmentation study. One data cut would confirm or kill them before they go on the wall.'
  },
  {
    week: 'Weeks 1 and 7',
    question: 'Which recorded calls can we use \u2014 one long non-converting call, and one saved retention call?',
    why: 'Two modules are built around listening to a real call. Call listening is already routine on onboarding Day 2, so the process exists; we just need clips that do not belong to anyone in the room.'
  },
  {
    week: 'Whole programme',
    question: 'Who runs stand-up, and who owns writing the 18 new modules?',
    why: 'Five modules are deliverable today and five need condensing. Eighteen need authoring. That is the real workload behind this chart.'
  },
  {
    week: 'Whole programme',
    question: 'Do we want a Friday recap, or does Thursday commit-and-close work as the weekly finish?',
    why: 'The brief says Monday to Thursday, so the curriculum respects that. Worth confirming whether anything lands on Friday at all.'
  }
];
