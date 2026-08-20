/*
 * Telesales micro-training curriculum.
 *
 * Sessions run Monday to Thursday, 15 minutes each, at morning stand-up.
 * One slide deck = one 15-minute session = one day.
 *
 * Sections mirror the Google Drive folder structure, and each section runs for
 * as many days as it has decks. Section length therefore varies: SPH is five
 * days, Customer Needs is seven.
 *
 * To reorder the programme, move section objects inside PROGRAMME.sections.
 * Week numbers and calendar dates are derived from position in the running
 * schedule, so nothing else needs editing.
 *
 * status:  'ready'    the slide deck exists in the Drive folder
 *          'building' the deck is being written now
 *          'planned'  the deck does not exist yet
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
  ready: {
    short: 'Deck',
    name: 'Deck built in Drive',
    blurb: 'A slide deck already exists in this folder. The lesson plan below is the proposed 15-minute shape for it.'
  },
  building: {
    short: 'WIP',
    name: 'Deck in progress',
    blurb: 'Being written now.'
  },
  planned: {
    short: 'To do',
    name: 'Deck still to build',
    blurb: 'No deck yet. The lesson plan below is the brief for building it.'
  }
};

const PROGRAMME = {
  title: 'Telesales Micro-Training',
  startMonday: '2026-08-24',
  days: ['Mon', 'Tue', 'Wed', 'Thu'],
  // 'continuous' runs decks back to back. 'weekAligned' starts every section
  // on a Monday, which is tidier but adds three weeks of gaps.
  packing: 'continuous',
  sections: [
    {
      name: 'SPH \u2014 Sales Per Hour',
      short: 'SPH',
      colour: 'coral',
      folder: 'SPH',
      driveUrl: null,
      decksReady: 5,
      outcome: 'Every agent knows their own SPH, can name the three levers behind it, and has picked one to work on.',
      modules: [
        {
          title: 'Know your number',
          label: 'Your number',
          status: 'ready',
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
          label: 'More calls an hour',
          status: 'ready',
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
          gap: 'Needs the current Adversus disposition and quick-key list. The onboarding Day 2 systems session already covers Adversus, so pull it from there.',
          sources: [{ label: 'Onboarding \u2014 Day 2: Hands On With the Systems', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Lever two: talk time that pays',
          label: 'Talk time that pays',
          status: 'ready',
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
          sources: [{ label: 'Onboarding \u2014 Day 2: Call Listening', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Lever three: converting the conversations you get',
          label: 'Convert the calls',
          status: 'ready',
          objective: 'Every agent knows their own contact conversion rate and the one beat of the call where they lose most deals.',
          hook: 'You can win the first two levers and still have a poor SPH. Dialling faster only pays if the conversations convert.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Two agents with identical call volumes and a ten-point gap in contact conversion. Volume was never the difference.' },
            { time: '2\u20137', label: 'Teach', detail: 'Contact conversion is sales divided by conversations that actually happened. Where it leaks: no discovery, presenting to nobody in particular, and never actually asking. Conversion week goes deep on this \u2014 today is about owning the number.' },
            { time: '7\u201312', label: 'Drill', detail: 'Each agent names the beat where they think they lose most deals, then a partner who has heard them on the phone says whether they agree.' },
            { time: '12\u201315', label: 'Commit', detail: 'One beat each to watch this week. Write it next to your SPH on the board.' }
          ],
          metric: 'Contact CVR \u2014 dashboard, Team Overview',
          coach: 'Keep this short on theory. It is the handshake between the SPH maths and the conversion section later in the programme.'
        },
        {
          title: 'The SPH that actually counts',
          label: 'SPH that counts',
          status: 'ready',
          objective: 'Every agent understands that a sale which pauses before the box lands was never a sale, and picks one lever target for the week.',
          hook: 'Across the team, 4.1% of sales pause before the first box is even delivered. Rep by rep that runs from 1.8% to 8.8% \u2014 a fivefold spread on the same product and the same leads.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The 1.8% to 8.8% spread. Name nobody. The range is the lesson.' },
            { time: '3\u20138', label: 'Teach', detail: 'Gross SPH versus retained SPH. Six in ten of those pre-delivery pauses say \u201cdo not want subscription\u201d \u2014 that is an expectation we set on the call, not a product fault. Commission is moving to valid sale, second payment, 28 days, 84 days.' },
            { time: '8\u201312', label: 'Drill', detail: 'Each agent picks one lever, one number and one behaviour for the week. Write it down, not just say it.' },
            { time: '12\u201315', label: 'Commit', detail: 'Onto the whiteboard. Next Monday\u2019s stand-up opens by reading these back.' }
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
      name: 'Customer Needs',
      short: 'Customer Needs',
      colour: 'blue',
      folder: 'Customer Needs',
      driveUrl: null,
      decksReady: 7,
      outcome: 'Every agent captures the facts that predict retention, hears the risk inside the answer, and plays it back before pitching.',
      modules: [
        {
          title: 'The four facts we never end a call without',
          label: 'The four facts',
          status: 'ready',
          objective: 'Every agent asks and logs all four discovery facts on every call.',
          hook: 'Forty per cent of every pause we get says \u201cpet did not eat the food\u201d. Most of that is decided by what we learn in the first three minutes of the call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The 40%. Say it plainly: our biggest churn reason is set on our call, before the food ever ships.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four. What is she eating right now. Easy, normal or fussy. The household. And what made you look at us today. Every one of them changes something we do later \u2014 the next four sessions take one each.' },
            { time: '7\u201312', label: 'Drill', detail: 'Pairs, ninety seconds each way. Get all four without it sounding like a form.' },
            { time: '12\u201315', label: 'Commit', detail: 'All four in the notes on every sale today. Nothing else changes this week.' }
          ],
          metric: 'Completion rate on Eater Type and previous-food fields',
          coach: 'These fields already exist in the export. This is about filling them properly, not adding anything new.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section E', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 required capture fields', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Asking without interrogating',
          label: 'Ask, don\u2019t quiz',
          status: 'ready',
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
          title: 'What is she eating right now',
          label: 'What she eats now',
          status: 'ready',
          objective: 'Every agent gets the current food to the level of dry, wet, raw or mixed, plus the brand where the customer knows it.',
          hook: 'This is the single most useful sentence in the whole call. It sets the transition length, the first recipe and the promise we are allowed to make.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: '\u201cWhat\u2019s she eating at the moment?\u201d One question, and everything downstream depends on the answer.' },
            { time: '2\u20137', label: 'Teach', detail: 'Four answers and what each one means for us. Dry or kibble: the longest switch there is. Wet: a week to ten days. Raw: quick. Mixed: somewhere in between. Get the brand too where they know it \u2014 it tells you how strong the habit is.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer plays four customers with vague answers. Get each one to a usable category without putting words in their mouth.' },
            { time: '12\u201315', label: 'Commit', detail: 'Never log \u201ccat food\u201d again. Dry, wet, raw or mixed, plus a brand where you have it.' }
          ],
          metric: 'Share of sales with previous food logged to category level',
          coach: 'The transition tracks in the retention section only work if this field is clean. Make the link explicit so it does not feel like admin.',
          sources: [
            { label: 'Master Plan \u2014 transition tracks by previous food', href: 'retention-improvement-master-plan.html' },
            { label: 'Transition & Texture deck \u2014 Section E', href: 'transition-texture-training-deck.html' }
          ]
        },
        {
          title: 'Easy, normal or fussy',
          label: 'Easy or fussy',
          status: 'ready',
          objective: 'Every agent captures eating type and knows what each answer changes at the point of sale.',
          hook: '\u201cShe\u2019s a bit fussy\u201d is a reason to buy and a warning light at the same time. Cats flagged fussy are 3.37% more likely to pause.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The fussy line. Two meanings in one sentence, and most of us only hear the first.' },
            { time: '2\u20137', label: 'Teach', detail: 'Easy, normal, fussy \u2014 and what each changes. Fussy: add a week to the transition, widen the recipe spread, and say the Fussy Cat Promise out loud. Breed, by the way, shows no meaningful signal at all, so stop asking about it.' },
            { time: '7\u201312', label: 'Drill', detail: 'Six customer lines. Team calls easy, normal or fussy, then says the one thing that changes because of it.' },
            { time: '12\u201315', label: 'Commit', detail: 'When you hear fussy, say the plan out loud before you close. Do not save it for the notes.' }
          ],
          metric: 'Early pause rate for sales flagged fussy at point of sale',
          sources: [
            { label: 'Pause Tracker \u2014 fussy premium', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 the Fussy Cat Promise', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'The household: who feeds her',
          label: 'Who feeds her',
          status: 'ready',
          objective: 'Every agent can set portions, cadence and delivery for a household rather than for a single cat.',
          hook: 'The person who feeds her is not always the person on the phone.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask how many of them routinely find out who does the feeding. It will be very few.' },
            { time: '2\u20137', label: 'Teach', detail: 'How many cats and who eats what. Portions when two cats share. Cadence against fridge and freezer space. Delivery day and who is actually home. This is where inconvenience pauses get prevented.' },
            { time: '7\u201312', label: 'Drill', detail: 'Two-cat scenario worked out loud: portions, trays, cadence, delivery day. All four, no gaps.' },
            { time: '12\u201315', label: 'Commit', detail: 'Ask who feeds her on every call today.' }
          ],
          metric: 'Share of pauses citing inconvenience \u2014 currently 3.4%'
        },
        {
          title: 'Hearing the reason and the risk in one sentence',
          label: 'Reason and risk',
          status: 'ready',
          objective: 'Every agent can name the buying motive and the retention risk from a single customer answer.',
          hook: 'The same sentence usually contains both why they will buy and why they might leave. Most of us only write down the first half.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read one customer answer. Ask for the buying reason. Then ask for the risk hiding in the same words.' },
            { time: '2\u20137', label: 'Teach', detail: 'Three motives: health worry, fussiness and food boredom, convenience. Three risk flags: currently on kibble, flagged fussy, and wants one recipe only \u2014 that last group is 1.6% of customers and the worst retention of any.' },
            { time: '7\u201312', label: 'Drill', detail: 'Six real customer lines. The team calls the motive and the flag for each. Fast, no debate.' },
            { time: '12\u201315', label: 'Commit', detail: 'Say both halves in your notes: why they bought, and what we are watching.' }
          ],
          metric: 'Average distinct recipes per subscription \u2014 currently 4.53',
          sources: [{ label: 'Pause Tracker \u2014 recipe variety against retention', href: 'd2ms-retention-pause-tracker.html' }]
        },
        {
          title: 'Play it back, then write it down',
          label: 'Play it back',
          status: 'ready',
          objective: 'Every agent can recap needs in twenty seconds and leave a note the retention team can act on.',
          hook: 'If you can play it back, they know you listened. If you write it down, the next person can pick up where you left off.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a real note that tells the next person nothing, then one that tells them everything.' },
            { time: '2\u20137', label: 'Teach', detail: 'The twenty-second recap: \u201cSo she\u2019s on kibble, a bit picky, one cat, and you\u2019re mainly worried about her weight. Here\u2019s what I\u2019d do.\u201d Then the note standard: previous food, eating type, recipes chosen, portion, household.' },
            { time: '7\u201312', label: 'Drill', detail: 'Recap drill. Trainer reads out a set of mock notes, agent delivers the twenty-second recap from them.' },
            { time: '12\u201315', label: 'Commit', detail: 'Recap out loud before every close today. It costs twenty seconds and it changes the close.' }
          ],
          metric: 'Note quality on the retention QA scorecard',
          sources: [
            { label: 'Transition & Texture deck \u2014 scorecard read-back', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 structured reason capture', href: 'retention-improvement-master-plan.html' }
          ]
        }
      ]
    },
    {
      name: 'Product & Food',
      short: 'Product & Food',
      colour: 'teal',
      folder: 'Product and Food',
      driveUrl: null,
      decksReady: 0,
      outcome: 'Every agent can describe the range, set the right portion, name textures, build a wider box and get the logistics right.',
      modules: [
        {
          title: 'The range in sixty seconds',
          label: 'Range in 60 seconds',
          status: 'planned',
          objective: 'Every agent can describe the range \u2014 recipes, textures, tray sizes, cadence \u2014 in under a minute with no notes.',
          hook: 'If it takes you two minutes to explain what they are buying, you have already lost the call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask one agent to explain the range cold. Time it. It will be too long, and that is the lesson.' },
            { time: '2\u20137', label: 'Teach', detail: 'What the food is and how it is made, the recipes, two textures in every tray, tray sizes, delivery cadence. Then the one-breath version that keeps only what is a reason to buy.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers the sixty-second range out loud, timed. Cut anything that is not a reason to buy.' },
            { time: '12\u201315', label: 'Commit', detail: 'Short version only today. Stop explaining, start matching.' }
          ],
          metric: 'Average handling time on the presentation beat',
          gap: 'Blocked pending facts. The recipe list, tray sizes and cadence options are not written down anywhere in this repository, and the retention copy review flags product variants as an unresolved author query. This deck needs a confirmed product fact sheet before it can be built.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section B: the science', href: 'transition-texture-training-deck.html' },
            { label: 'Copy Review \u2014 slide 16 \u201cOur flavours\u201d (flagged for confirmation)', href: 'retention-training-copy-review.html' }
          ]
        },
        {
          title: 'Portions: four bands cover almost everyone',
          label: 'Four portion bands',
          status: 'planned',
          objective: 'Every agent can set the right portion on the call and say it in grams and in meals.',
          hook: 'We run 42 feeding segments in Looker. But 92.1% of cats land in just four: 65g, 90g, 130g and 180g.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Forty-two segments, four that matter. Complexity on our side does not have to reach the customer.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four bands. Then how to say it so it lands: \u201cshe\u2019s 90g a day, so that\u2019s one tray split into two meals\u201d. Grams alone mean nothing to them; meals do.' },
            { time: '7\u201311', label: 'Drill', detail: 'Four quick scenarios. Call the band, then say the line in grams and in meals.' },
            { time: '11\u201315', label: 'Commit', detail: 'State the portion both ways on every sale today.' }
          ],
          metric: 'Share of pauses citing inconvenience \u2014 currently 3.4%',
          sources: [
            { label: 'Master Plan \u2014 grams-per-day segments', href: 'retention-improvement-master-plan.html' },
            { label: 'Pause Tracker \u2014 inconvenience pauses', href: 'd2ms-retention-pause-tracker.html' }
          ]
        },
        {
          title: 'Texture is what she actually tastes',
          label: 'Texture, not recipe',
          status: 'planned',
          objective: 'Every agent matches the first serve to what the cat eats now, using texture language that is specific.',
          hook: 'Cats do not read the recipe name. They meet a texture.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line. Then ask: when you describe the food, do you name the recipe or the texture?' },
            { time: '2\u20137', label: 'Teach', detail: 'Two textures in every tray. The texture ladder from what she eats now to what we send. Vague language versus specific language. Match the first serve to her current food.' },
            { time: '7\u201312', label: 'Drill', detail: '\u201cSay this, not that\u201d \u2014 six pairs. Read the weak line, then the strong one.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name the texture, not just the recipe, on every call today.' }
          ],
          metric: 'Texture match rate on first serve',
          coach: 'The content for this deck already exists: lift Section D of the Transition & Texture deck, slides 15 to 19, and cut to one idea.',
          sources: [{ label: 'Transition & Texture deck \u2014 Section D: Texture nuance', href: 'transition-texture-training-deck.html' }]
        },
        {
          title: 'Variety sells and variety keeps',
          label: 'Variety sells',
          status: 'planned',
          objective: 'Every agent builds a wider box and can say why in one sentence.',
          hook: 'Customers who take all seven recipes retain at 56.4% at 28 days. Four recipes retains at 46.7%. Our average is 4.53.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read the two numbers. Nearly ten points of retention sits between a narrow box and a wide one.' },
            { time: '2\u20137', label: 'Teach', detail: 'The variety curve. Only 1.6% take a single recipe and they churn hardest of all. How to widen the box without lengthening the call.' },
            { time: '7\u201312', label: 'Drill', detail: 'Take a mock order with two recipes on it. Widen it out loud, in one sentence, without sounding like an upsell.' },
            { time: '12\u201315', label: 'Commit', detail: 'No box goes out with fewer than four recipes today unless the customer genuinely insists.' }
          ],
          metric: 'Average distinct recipes per subscription \u2014 currently 4.53',
          sources: [{ label: 'Pause Tracker \u2014 recipe variety against retention', href: 'd2ms-retention-pause-tracker.html' }]
        },
        {
          title: 'Cadence, storage and delivery',
          label: 'Cadence and storage',
          status: 'planned',
          objective: 'Every agent sets a cadence the customer can physically store, and a delivery day they will be in for.',
          hook: '3.4% of pauses say we are too inconvenient. That is almost always a cadence or a delivery day agreed too quickly on our call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Inconvenience is not a product fault. It is a fifteen-second conversation we did not have.' },
            { time: '2\u20137', label: 'Teach', detail: 'Cadence against portion size and fridge or freezer space. Which delivery days work for which households. What to do when they have neither space nor a safe place.' },
            { time: '7\u201312', label: 'Drill', detail: 'Three households: a flat with a small freezer, a two-cat house, someone out all week. Set cadence and delivery day for each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Ask about storage space before you confirm a cadence.' }
          ],
          metric: 'Share of pauses citing inconvenience \u2014 currently 3.4%',
          gap: 'Needs the current cadence options and the delivery day availability by region before the deck can be written.'
        }
      ]
    },
    {
      name: 'Conversion',
      short: 'Conversion',
      colour: 'green',
      folder: 'Conversion',
      driveUrl: null,
      decksReady: 0,
      outcome: 'Every agent runs a structured call, matches instead of lists, recommends the right trial box and asks for the sale.',
      modules: [
        {
          title: 'Structure beats script',
          label: 'The five beats',
          status: 'planned',
          objective: 'Every agent can name the five beats of our call and say which one they personally rush.',
          hook: 'You do not need a script. You need to always know which beat you are in.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask the room to name the five beats. Whatever comes back tells you where to spend the next five minutes.' },
            { time: '2\u20137', label: 'Teach', detail: 'Open, discover, present, handle, close. What each beat is for and what it hands to the next one. The most common failure is jumping from open straight to present.' },
            { time: '7\u201312', label: 'Drill', detail: 'Play a two-minute call opening. The team calls the beats out loud as they happen.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name your beat in your head on every call today. That is all.' }
          ],
          metric: 'Contact conversion rate \u2014 dashboard, Contact CVR',
          coach: 'The pitch structure is already taught on onboarding Day 1. Pull the five beats straight from there so the language matches.',
          sources: [{ label: 'Onboarding \u2014 Day 1: The Pitch', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Match, don\u2019t list',
          label: 'Match, don\u2019t list',
          status: 'planned',
          objective: 'Every agent presents three things maximum, each tied to something the customer actually said.',
          hook: 'Nine features is not nine reasons to buy. It is nine chances to say something they do not care about.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a nine-feature pitch out loud at speed. Ask what they remember. It will be almost none of it.' },
            { time: '2\u20137', label: 'Teach', detail: 'The match rule: every feature must attach to a need you heard in discovery. Three is the ceiling. The sentence shape is \u201cyou said ___, so ___, which means ___ for her\u201d.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer gives three discovery facts. Agent builds the three-feature match on the spot, out loud, no preparation.' },
            { time: '12\u201315', label: 'Commit', detail: 'Three features today, each one attached to something they told you.' }
          ],
          metric: 'Contact conversion rate',
          coach: 'If an agent cannot attach a feature to a need, that is a discovery problem showing up in the presentation. Send them back to the Customer Needs decks.'
        },
        {
          title: 'The trial box: seven days or fourteen',
          label: '7 or 14 days',
          status: 'planned',
          objective: 'Every agent can recommend a trial length and say why, rather than defaulting to whatever is on the screen.',
          hook: 'The 14-day trial box early-pauses at 19.7%. The 7-day box early-pauses at 27.2%. Trial box length is the strongest single driver in the whole dataset.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The two numbers, and the fact that 28-day retention is essentially identical between them. The longer box buys the transition time to actually work.' },
            { time: '3\u20138', label: 'Teach', detail: 'Which cat gets which. Kibble-fed or flagged fussy: fourteen days, because the switch is longer. Raw or wet already: seven can be fine. How to present it as a recommendation rather than an option list.' },
            { time: '8\u201313', label: 'Drill', detail: 'Four cats. Recommend a trial length for each and justify it in one sentence.' },
            { time: '13\u201315', label: 'Commit', detail: 'Recommend, do not offer. Say which one you would pick and why.' }
          ],
          metric: 'Trial box mix, and early pause rate by trial length',
          gap: 'Trial length is still listed as an open decision in the master plan. Get a commercial yes or no from Ed before this deck is built, or agents will be contradicted.',
          sources: [{ label: 'Pause Tracker \u2014 trial box duration comparison', href: 'd2ms-retention-pause-tracker.html' }]
        },
        {
          title: 'Asking for the sale',
          label: 'Ask for the sale',
          status: 'planned',
          objective: 'Every agent asks for the sale directly and then stops talking.',
          hook: 'Most lost deals are not argued away. They are talked past.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask three agents to deliver their close. Count how many keep talking after it.' },
            { time: '2\u20137', label: 'Teach', detail: 'The assumptive close and the two-option close. Where to put the close in the call. And the hardest part: ask, then be quiet and let them answer.' },
            { time: '7\u201313', label: 'Drill', detail: 'Closing round. Everyone delivers their close out loud, once, then stops. The silence is the exercise, not the words.' },
            { time: '13\u201315', label: 'Commit', detail: 'Ask once, clearly, then wait. Every call today.' }
          ],
          metric: 'Contact conversion rate'
        },
        {
          title: '\u201cI don\u2019t want a subscription\u201d',
          label: 'The contract question',
          status: 'planned',
          objective: 'Every agent can handle the subscription objection honestly, without overpromising flexibility we do not have.',
          hook: '21.5% of all pauses say \u201cdo not want subscription\u201d. Among customers who pause before the box even arrives, it is 60%.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The 60%. These people said yes to us and changed their mind in the quiet afterwards. That is our call, not the product.' },
            { time: '3\u20138', label: 'Teach', detail: 'This is a commitment worry, not a price worry. Name the flexibility precisely \u2014 skip, pause, change recipes, move the date \u2014 and never round it up into \u201ccancel any time\u201d if that is not exactly true.' },
            { time: '8\u201313', label: 'Drill', detail: 'Role play: enthusiastic customer who then asks \u201cso is this a contract?\u201d. Two minutes each way.' },
            { time: '13\u201315', label: 'Commit', detail: 'Say the flexibility in specific terms on every sale today. Specific beats generous.' }
          ],
          metric: 'Pre-delivery pause rate \u2014 currently 4.1% of sales',
          gap: 'Blocked. Needs the exact signed-off wording for skip, pause and cancel. This is the highest-value line in the whole curriculum and it has to be legally clean before it goes in a deck.',
          sources: [
            { label: 'Pause Tracker \u2014 pause reason mix and pre-delivery breakdown', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Copy Review \u2014 slide 04: subscription versus acceptance', href: 'retention-training-copy-review.html' }
          ]
        }
      ]
    },
    {
      name: 'Objection Handling',
      short: 'Objections',
      colour: 'purple',
      folder: 'Objection Handling',
      driveUrl: null,
      decksReady: 3,
      outcome: 'Every agent states price without flinching, has a first sentence for the objections we actually get, and never discounts to fix a food problem.',
      modules: [
        {
          title: 'Cost per day, not cost per box',
          label: 'Cost per day',
          status: 'ready',
          objective: 'Every agent can state the price and reframe it into a daily number without hesitating.',
          hook: 'If you hesitate on price, you have told them it is too much before they have decided for themselves.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask three agents for the price of a 90g cat. Any hesitation proves the point.' },
            { time: '2\u20137', label: 'Teach', detail: 'Price by portion band, said flat with no apology. Then the daily reframe: a box price is a number they have to judge, a daily price is one they can compare to something they already buy.' },
            { time: '7\u201312', label: 'Drill', detail: 'Rapid fire. Trainer calls a portion band, agent states the box price and the price per day. Round the room twice.' },
            { time: '12\u201315', label: 'Commit', detail: 'Give the daily number before they ask for it.' }
          ],
          metric: 'Objection rate on price at the presentation beat',
          gap: 'There is no price list anywhere in this repository. If the deck already has the numbers in it, send them over so the rest of the curriculum can use the same figures.'
        },
        {
          title: 'The five price objections',
          label: 'Five answers ready',
          status: 'ready',
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
          label: 'Never discount',
          status: 'ready',
          objective: 'Every agent uses the offer ladder instead of money in the first 28 days.',
          hook: 'A discount will not make her eat it. Money does not fix a food problem \u2014 it just makes the same problem cheaper.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line, said once. It does most of the work on its own.' },
            { time: '2\u20137', label: 'Teach', detail: 'The offer ladder: free recipe swap, texture swap, rescue kit, portion reset, delivery date shift, transition clinic. No discounts inside 28 days \u2014 that is a rule, not a preference.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play: customer asks for money on day six because the cat is not eating. Get to a swap without getting defensive.' },
            { time: '12\u201315', label: 'Commit', detail: 'Zero discounts inside 28 days this week. Log what you offered instead \u2014 that log is the data we are missing.' }
          ],
          metric: 'Swap-to-pause ratio',
          coach: 'Section G of the Transition & Texture deck already has the offer ladder and the replacement line written. Worth checking the existing deck matches it.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section G: Swap, don\u2019t stop', href: 'transition-texture-training-deck.html' },
            { label: 'First 72 Hours \u2014 the offer ladder', href: 'first-72-hours-programme.html' },
            { label: 'Master Plan \u2014 guardrail: no discounting inside 28 days', href: 'retention-improvement-master-plan.html' }
          ]
        }
      ]
    },
    {
      name: 'Call Listening',
      short: 'Call Listening',
      colour: 'rust',
      folder: 'Call Listening',
      driveUrl: null,
      decksReady: 0,
      outcome: 'Every agent can hear the difference between a strong and a weak call, say why, and score their own.',
      modules: [
        {
          title: 'What a good call sounds like',
          label: 'A good call',
          status: 'planned',
          objective: 'Every agent can point to the moments that made a call work, using the five beats as the language.',
          hook: 'You cannot copy what you cannot hear. Today we listen to one that worked and name exactly why.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Set the task before you play anything: listen for the beats, not the personality.' },
            { time: '2\u20139', label: 'Listen', detail: 'Play a clipped call that converted and retained. Everyone marks where each beat started.' },
            { time: '9\u201313', label: 'Drill', detail: 'Round the room: one thing the agent did that you are going to steal. No general praise \u2014 name the sentence.' },
            { time: '13\u201315', label: 'Commit', detail: 'Use one borrowed line today and report back tomorrow whether it worked.' }
          ],
          metric: 'QA scorecard average',
          gap: 'Needs one clipped call that both converted and survived 28 days, with the customer\u2019s permission position confirmed. Do not use a call belonging to anyone in the room.',
          sources: [{ label: 'Onboarding \u2014 Day 2: Call Listening', href: 'telesales-onboarding-schedule.html' }]
        },
        {
          title: 'Where the call went wrong',
          label: 'Where it went wrong',
          status: 'planned',
          objective: 'Every agent can find the single minute a call stopped being winnable.',
          hook: 'Weak calls rarely fail at the close. They fail somewhere in the middle, quietly, and the close is just where it becomes obvious.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The failure is usually earlier than you think. Your job is to find the minute.' },
            { time: '2\u20139', label: 'Listen', detail: 'Play a clipped call that did not convert. Everyone writes down one timestamp and one reason.' },
            { time: '9\u201313', label: 'Drill', detail: 'Compare timestamps. They will cluster. Discuss what should have happened at that moment instead.' },
            { time: '13\u201315', label: 'Commit', detail: 'Watch for that same moment in your own calls today.' }
          ],
          metric: 'Contact conversion rate',
          gap: 'Needs one clipped non-converting call. Keep it anonymous \u2014 this session dies the moment it feels like a public post-mortem.',
          coach: 'Ban the phrase \u201cthey were never going to buy\u201d. It is the fastest way to waste the session.'
        },
        {
          title: 'Scoring your own call',
          label: 'Score your own',
          status: 'planned',
          objective: 'Every agent can score one of their own calls against the scorecard and name one thing to change.',
          hook: 'The agents who improve fastest are the ones who listen to themselves. It is uncomfortable for about a week.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Nobody enjoys this. Everybody who does it gets better.' },
            { time: '2\u20136', label: 'Teach', detail: 'The scorecard, four lines only: clear price, clear product, no overpromising, strong next steps. What each one means and what a fail sounds like.' },
            { time: '6\u201313', label: 'Drill', detail: 'Everyone scores one of their own calls from this week against the four lines, privately.' },
            { time: '13\u201315', label: 'Commit', detail: 'One line each to fix. Nobody has to share their score, only what they are changing.' }
          ],
          metric: 'Retention scorecard: clear price, clear product, no overpromising, strong next steps',
          coach: 'Private scoring. The moment this becomes a league table, agents start picking their easiest call.',
          sources: [{ label: 'Retention Data Plan \u2014 Stage 2: retention scorecard', href: 'd2ms-retention-data-plan.html' }]
        }
      ]
    },
    {
      name: 'Demographics & Personas',
      short: 'Demographics',
      colour: 'magenta',
      folder: 'Demographics',
      driveUrl: null,
      decksReady: 0,
      decksBuilding: 1,
      outcome: 'Every agent can place a customer into a working profile in the first minute and adapt the opening without changing the facts.',
      modules: [
        {
          title: 'What we actually know about our customers',
          label: 'What we know',
          status: 'building',
          objective: 'Every agent knows which customer facts we hold, which we do not, and which ones predict retention.',
          hook: 'We know her eater type, her weight and her postcode. We do not know the owner\u2019s age or income. So our profiles have to be built out of behaviour, not guesses.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'What we hold versus what we imagine we hold. Profiles built on invention get contradicted on live calls.' },
            { time: '2\u20137', label: 'Teach', detail: 'The fields we capture: eater type, body type, breed, age in months, weight, activity level, postcode, pouch size, cadence, trial length, recipe count. Which move retention: trial length, recipe variety, eater type. Which does not: breed.' },
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
          label: 'Four profiles',
          status: 'planned',
          objective: 'Every agent can place a customer into one of four profiles inside the first minute.',
          hook: 'You are not adapting the product. You are adapting the first thirty seconds.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Same product, four different first thirty seconds. That is all a profile is for.' },
            { time: '2\u20138', label: 'Teach', detail: 'Four profiles built from what we capture. The Worried Owner: health-led, older cat, wants reassurance. The Fussy-Cat Veteran: tried everything, needs the honest transition story. The Convenience Household: multi-cat, cadence-sensitive. The Kitten Starter: habits still forming, longest life if box one lands.' },
            { time: '8\u201312', label: 'Drill', detail: 'Four one-line customer intros. The team calls the profile for each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name the profile in your notes on every sale today.' }
          ],
          metric: 'Early pause rate cut by profile, once we start tagging',
          gap: 'These four profiles are drafts written from the export fields, not the output of a segmentation study. A cut of early pause rate by eater type, cat age band and household cat count would confirm or kill them before they go in a deck.'
        },
        {
          title: 'Reading the profile in the first minute',
          label: 'The first minute',
          status: 'planned',
          objective: 'Every agent can place a customer without asking a single profiling question.',
          hook: 'You do not ask someone which profile they are. You listen to how they open.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells are in the first thing they volunteer, not in anything we ask.' },
            { time: '2\u20137', label: 'Teach', detail: 'What each profile tends to lead with, and the one clarifying question that confirms it without sounding like research.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer reads eight opening lines. Team calls the profile in under three seconds each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Place the customer before you present, not after.' }
          ],
          metric: 'QA score on tailoring the opening',
          gap: 'Depends on the four profiles being validated first.'
        },
        {
          title: 'Same facts, different opening',
          label: 'Four openings',
          status: 'planned',
          objective: 'Every agent has a tailored opening for each profile, using identical product facts.',
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
      name: 'Retention & Churn',
      short: 'Retention',
      colour: 'brown',
      folder: 'Retention',
      driveUrl: null,
      decksReady: 0,
      outcome: 'Every agent sets a truthful transition expectation, delivers the mechanics, turns a pause request into a swap, and pre-sells the week-seven step-down.',
      modules: [
        {
          title: 'Where we actually lose customers',
          label: 'Where we lose them',
          status: 'planned',
          objective: 'Every agent can state where and when churn happens, from real numbers rather than instinct.',
          hook: '24.2% of our sales pause inside the first seven days. Nearly a third of every pause we ever get happens in the first six days. The single biggest day is day five.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The three numbers. Then the median: nine days to first pause. Not months. Days.' },
            { time: '3\u20138', label: 'Teach', detail: 'The shape of churn: the early cliff, the day-five peak, then a second wave at week seven. The reason mix: did not eat 40%, do not want subscription 21.5%, price 21.4%.' },
            { time: '8\u201313', label: 'Drill', detail: 'Predict then reveal. The team ranks the pause reasons on the board, then sees the real order.' },
            { time: '13\u201315', label: 'Commit', detail: 'Nothing behavioural today. Today is about knowing the battlefield before we fight on it.' }
          ],
          metric: 'Early pause rate under seven days \u2014 currently 24.2%',
          coach: 'Use the audited figures from the pause tracker, which are reproducible from the audit script. Avoid the older headline percentages in the decks \u2014 the denominators differ and someone will spot it.',
          sources: [
            { label: 'Pause Tracker \u2014 all figures', href: 'd2ms-retention-pause-tracker.html' },
            { label: 'Master Plan \u2014 the evidence we are building on', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Promise the process, not the outcome',
          label: 'Promise the process',
          status: 'planned',
          objective: 'Every agent sets a truthful transition expectation matched to the cat\u2019s current food.',
          hook: '\u201cShe\u2019ll love it\u201d is the most expensive sentence on the call. It sets a finish line we cannot control.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The sentence, and what it costs. We are not selling a verdict, we are setting up a trial.' },
            { time: '2\u20137', label: 'Teach', detail: 'The transition tracks. Kibble takes 14 days and can run to three or four weeks. Wet is 7 to 10 days. Raw is 3 to 7. Mixed is 10 to 14. Flagged fussy, add a week. Say the number on the call.' },
            { time: '7\u201312', label: 'Drill', detail: 'Four cats, four previous foods. Say the transition line for each, with the number in it.' },
            { time: '12\u201315', label: 'Commit', detail: 'State the transition window on every sale today. Promise the process and our support, never the cat\u2019s verdict.' }
          ],
          metric: 'Share of early pauses citing food refusal \u2014 currently 36.4%',
          coach: 'The tracks table is already written in Section E of the Transition deck and mirrored in the master plan, so the numbers agree. Lift it.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Section E: Transition tracks', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 transition tracks table', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'The mechanics you must say out loud',
          label: 'The six rules',
          status: 'planned',
          objective: 'Every agent can deliver the six transition mechanics in thirty seconds without missing one.',
          hook: 'Six instructions. Miss one and the first bowl can fail for a reason that has nothing to do with the food.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask for the six from memory. Count how many come back. It will not be six.' },
            { time: '2\u20137', label: 'Teach', detail: 'Warm the food. Clean plate. Old food and treats removed between meals. Start with chicken. Twenty minutes, then take it away. Introduce a second recipe only once one is settled.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers all six in thirty seconds while their partner ticks them off. Anyone who misses one goes again.' },
            { time: '12\u201315', label: 'Commit', detail: 'All six on every sale today. If you have not said them, you have not finished the call.' }
          ],
          metric: 'Warm-serve adoption, and first meal logged within 48 hours',
          coach: 'Already written in both the Transition deck and the master plan. This deck is pure repetition \u2014 run the session again a month later.',
          sources: [
            { label: 'Transition & Texture deck \u2014 the three mechanics', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 transition mechanics', href: 'retention-improvement-master-plan.html' }
          ]
        },
        {
          title: 'Swap, don\u2019t stop',
          label: 'Swap, don\u2019t stop',
          status: 'planned',
          objective: 'Every agent can turn a pause request into a swap, and knows where the full certification sits.',
          hook: 'The number we are chasing is the swap-to-pause ratio. Every swap is a customer who stayed.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Swap-to-pause as the signature metric. A pause is a decision; a swap is another chance.' },
            { time: '2\u20137', label: 'Teach', detail: 'The four calls you will get this week: she will not touch it; she ate it twice then stopped; it made her sick; I want to pause. The first move for each. Then the Fussy Cat Promise.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play brief A from the Transition deck: day-two refusal, kibble-fed fussy cat.' },
            { time: '12\u201315', label: 'Commit', detail: 'Book the full 90-minute Transition & Texture certification. This session was the trailer.' }
          ],
          metric: 'Swap-to-pause ratio, and certification coverage across the team',
          coach: 'Everything for this deck exists: four common calls, the offer ladder, role-play briefs A, B and C, and a twelve-question assessment. Build it as the hand-off into that certification rather than a replacement for it.',
          sources: [
            { label: 'Transition & Texture deck \u2014 Sections G and H', href: 'transition-texture-training-deck.html' },
            { label: 'Master Plan \u2014 the Fussy Cat Promise', href: 'retention-improvement-master-plan.html' },
            { label: 'First 72 Hours \u2014 swap-to-pause ratio', href: 'first-72-hours-programme.html' }
          ]
        },
        {
          title: 'The week-seven price cliff',
          label: 'The week 7 cliff',
          status: 'planned',
          objective: 'Every agent pre-sells the discount step-down on the first call so week seven is not a surprise.',
          hook: 'Price is barely in the first week of churn and heavily in the seventh. That second wave is not a pricing problem \u2014 it is a disclosure problem from eight weeks earlier.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'Retention drops as the acquisition discount steps down. Every one of those customers was told the price on day one \u2014 just not the whole price.' },
            { time: '3\u20138', label: 'Teach', detail: 'When the step-down lands, what the number becomes, and how to say it on the first call in one sentence without killing the sale. Then what value language to build now so week seven has something to stand on.' },
            { time: '8\u201313', label: 'Drill', detail: 'Everyone delivers the step-down sentence out loud, then handles \u201cthat\u2019s a big jump\u201d.' },
            { time: '13\u201315', label: 'Commit', detail: 'Say the step-down on every sale. A customer who knew is a customer who stays.' }
          ],
          metric: 'Week six to nine retention delta',
          gap: 'Blocked. Needs the current discount amount and the exact week it steps down. Same blocker as the Objection Handling pricing deck.',
          sources: [{ label: 'Master Plan \u2014 the week seven price cliff', href: 'retention-improvement-master-plan.html' }]
        }
      ]
    }
  ]
};

const OPEN_QUESTIONS = [
  {
    week: 'Drive folders',
    blocker: true,
    question: 'Can you send the Drive folder link, set so anyone with the link can view?',
    why: 'I have your deck counts but not the deck titles. The 15 built decks are currently shown against my proposed module names, which almost certainly do not match what you have called them. With the link I can read the titles and map them one to one.'
  },
  {
    week: 'Section lengths',
    blocker: true,
    question: 'How many decks are you planning for Product & Food, Conversion, Retention, and how many will Demographics end up with?',
    why: 'Those four sections currently use my proposed counts of 5, 5, 5 and 4. They drive the total length of the programme, so the finish date moves as soon as you change them.'
  },
  {
    week: 'Session mapping',
    blocker: true,
    question: 'Is one slide deck exactly one 15-minute session?',
    why: 'The whole schedule assumes it is, so Customer Needs with seven decks takes seven mornings. If any deck is really two sessions, or two short decks share a morning, the dates shift.'
  },
  {
    week: 'Scheduling',
    question: 'Continuous or week-aligned \u2014 can a section start on a Wednesday, or should every section start on a Monday?',
    why: 'Continuous finishes in 10 weeks with no gaps. Week-aligned is tidier to talk about but pushes the programme to 13 weeks and leaves 12 empty mornings. There is a toggle on the page so you can see both. Continuous is the current default.'
  },
  {
    week: 'Order',
    question: 'Is the section order right? SPH is first as agreed, then Customer Needs, Product & Food, Conversion, Objection Handling, Call Listening, Demographics, Retention.',
    why: 'I put Conversion after Product & Food because closing is the output of discovery and product fluency. Call Listening sits sixth so agents can score real calls against everything already covered. Reordering is a single move in the data file.'
  },
  {
    week: 'Pricing',
    question: 'There is no separate Pricing folder \u2014 is pricing and value meant to live inside Objection Handling?',
    why: 'I have put the price and value modules there, with the week-seven step-down in Retention. If pricing deserves its own folder, say so and I will split it out.'
  },
  {
    week: 'Start date',
    question: 'Does the programme start Monday 24 August?',
    why: 'That is the current default on the chart. Monday 31 August is the summer bank holiday, so whichever week that falls in loses a morning \u2014 the chart flags it in red.'
  },
  {
    week: 'Objection Handling',
    question: 'Do your three objection decks cover price only, or non-price objections too?',
    why: 'Three feels light for objection handling. My three are all price and value. If the contract objection and the \u201cI\u2019ll think about it\u201d stall are not covered elsewhere, this folder probably wants five.'
  },
  {
    week: 'Blockers carried over',
    blocker: true,
    question: 'Still outstanding: the product fact sheet, the price list and step-down week, and the signed-off skip/pause/cancel wording.',
    why: 'Five decks cannot be written without these. If the numbers are already inside your Objection Handling decks, sending them over unblocks the Product, Conversion and Retention decks too.'
  },
  {
    week: 'Call recordings',
    question: 'Which calls can we use \u2014 one that converted and retained, one that did not convert, and can agents access their own recordings?',
    why: 'All three Call Listening decks are built around a real clip, and the third asks agents to score themselves.'
  }
];
