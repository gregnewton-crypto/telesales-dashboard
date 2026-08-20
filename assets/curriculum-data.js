/*
 * Telesales micro-training curriculum.
 *
 * Sessions run Monday to Thursday, 15 minutes each, at morning stand-up.
 * One slide deck = one 15-minute session = one day.
 *
 * Sections mirror the Google Drive folders, and each section runs for as many
 * days as it has decks. Deck names, counts and content were read from Drive on
 * 20 August 2026 and are recorded in assets/drive-inventory.md. Re-read the
 * folders and update both files together.
 *
 * status:  'ready'   the deck exists and has real content
 *          'stub'    the deck exists but its body is placeholder or duplicated
 *          'planned' the deck does not exist yet
 */

const DRIVE_ROOT = 'https://drive.google.com/drive/folders/1Q_r8tLmRhhPWPTxQ7q_hudYE1fDVTKrP';

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
    name: 'Deck ready in Drive',
    blurb: 'The deck exists and has real content in it.'
  },
  stub: {
    short: 'Stub',
    name: 'Deck exists, body still to write',
    blurb: 'The deck is in the folder but its content is placeholder or copied from another deck.'
  },
  planned: {
    short: 'To do',
    name: 'Deck still to build',
    blurb: 'No deck yet. The lesson plan is the brief for building it.'
  }
};

const PROGRAMME = {
  title: 'Telesales Micro-Training',
  startMonday: '2026-08-24',
  days: ['Mon', 'Tue', 'Wed', 'Thu'],
  packing: 'continuous',
  sections: [
    {
      name: 'SPH \u2014 Sales Per Hour',
      short: 'SPH',
      colour: 'coral',
      folder: 'SPH',
      driveUrl: 'https://drive.google.com/drive/folders/19W6QkGIx3Xqm8G0Dku736pNk-HLPCAs1',
      outcome: 'Every agent can work out their own SPH, knows which of the three targets they are chasing, and has walked the four stages of the call.',
      modules: [
        {
          title: 'What SPH is and what we are aiming for',
          label: 'What SPH is',
          deckName: 'SPH Part 1',
          deckUrl: 'https://docs.google.com/presentation/d/14EvN421ExcFu5ua66dRTBt0xkpgCc0yKeqqxEhq2Ln8/edit',
          status: 'ready',
          objective: 'Every agent can calculate their own SPH and name which of the three targets they are working to.',
          hook: 'Twenty sales across four shifts is 0.71. The standard is 0.6, good is 0.8, and a sale every hour is 1.0. This week is about deciding which of those you are chasing.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Put the worked example up: 20 sales, 28 hours, 0.71. Ask the room whether that is good.' },
            { time: '2\u20137', label: 'Teach', detail: 'SPH is sales divided by hours worked. Four shifts of seven hours is 28 hours. The three levels: 0.6 is the standard and IE has averaged 0.63; 0.8 is good; 1.0 is a sale every hour. In sales that is 17, 23 and 28 each per week.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone works out their own SPH for last week from their own sales and hours. Then says out loud which of the three they are nearest to.' },
            { time: '12\u201315', label: 'Commit', detail: 'Name the target you are working to for the next four weeks. Then flag what is coming: the four stages of the call, one a morning \u2014 Intro, Hook, Qualifying and Finding the Fix, and Closing.' }
          ],
          metric: 'SPH \u2014 0.6 standard, 0.8 good, 1.0 excellent',
          coach: 'Refresh the team numbers on the slide before you run it. The deck currently shows the last two weeks, and an out-of-date chart is the fastest way to lose the room.'
        },
        {
          title: 'The Intro: earning the first twenty seconds',
          label: 'The Intro',
          deckName: 'SPH Part 2',
          deckUrl: 'https://docs.google.com/presentation/d/1xjPLoqJe3ZLek0W4yVMv559vqtY7wNjVC33fFCPa8z4/edit',
          status: 'ready',
          objective: 'Every agent can open a call so the customer is still listening after twenty seconds.',
          hook: 'A buyer decides whether to stay on the line within the first 7 to 20 seconds. And 38% of the impression you make is voice and tone \u2014 only 7% is the actual words.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The 7 to 20 second window. Whatever you plan to say next, the decision is already being made.' },
            { time: '2\u20137', label: 'Teach', detail: 'The three parts of a strong intro: Tone, Reason, Rapport. Tone carries 38% of the impression and the words only 7%, so how you say it beats what you say.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers their own intro out loud twice \u2014 once flat, once with tone. The room calls the difference. Same words, different call.' },
            { time: '12\u201315', label: 'Commit', detail: 'One change to your intro today. Stand up while you make the first ten calls and notice what it does to your tone.' }
          ],
          metric: 'Share of connected calls lasting past thirty seconds'
        },
        {
          title: 'The Hook: leading with their problem',
          label: 'The Hook',
          deckName: 'SPH Part 3',
          deckUrl: 'https://docs.google.com/presentation/d/1a-zT_EwbyVQEmzivgfZZfk-BkT50uK0dkDHJEA6PPSE/edit',
          status: 'ready',
          objective: 'Every agent has a hook that names a problem the customer actually has, rather than a feature we happen to have.',
          hook: 'A hook is not \u201cwe do fresh dog food\u201d. It is the sentence that makes them think you already understand their problem.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a feature-led opener and a problem-led opener back to back. Ask which one they would stay on the line for.' },
            { time: '2\u20137', label: 'Teach', detail: 'The hook comes straight after the greeting and lands on a pain point, a trend or a goal they care about \u2014 never a feature. The three moves: Reframe, Respond, Follow up.' },
            { time: '7\u201312', label: 'Drill', detail: 'Pairs. One hook each, then the partner reframes it so it is about the dog rather than about the food.' },
            { time: '12\u201315', label: 'Commit', detail: 'Use one hook all day, unchanged, and count how many calls get past the first objection.' }
          ],
          metric: 'Contact conversion rate'
        },
        {
          title: 'Qualifying and Finding the Fix',
          label: 'Find the fix',
          deckName: 'SPH Part 4',
          deckUrl: 'https://docs.google.com/presentation/d/1ja41v87lo1W1z2iPA7YQQdRmIvIFVk2CynLo76gphmU/edit',
          status: 'stub',
          objective: 'Every agent can find the one thing this customer needs solving, and say it back before pitching anything.',
          hook: 'Qualifying is not a checklist. It is finding the fix \u2014 the specific thing that would make this person\u2019s week easier.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The difference between qualifying to disqualify and qualifying to find the fix. One ends calls, the other opens them.' },
            { time: '2\u20137', label: 'Teach', detail: 'What has to be established: the dog, what they feed now, what is not working about it, and who makes the decision. Then the move that matters \u2014 naming the fix out loud before you present.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer plays a customer with a vague complaint. Get to a named fix inside ninety seconds without listing a single feature.' },
            { time: '12\u201315', label: 'Commit', detail: 'Say the fix back to the customer before you present anything today.' }
          ],
          metric: 'Contact conversion rate',
          gap: 'The deck exists but its body is Part 2\u2019s content pasted in, still headed \u201cWhat make a good Hook\u201d. This lesson plan is a proposal for what should replace it.'
        },
        {
          title: 'Closing: ask once, then stop',
          label: 'Closing',
          deckName: 'SPH Part 5',
          deckUrl: 'https://docs.google.com/presentation/d/10gUlub7xk2nKh67jeFzOPAlyN044wGoWDC9-PGfL6Hg/edit',
          status: 'stub',
          objective: 'Every agent asks for the sale once, clearly, and then stops talking.',
          hook: 'Most lost deals are not argued away. They are talked past.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask three agents to deliver their close. Count how many keep talking after the question.' },
            { time: '2\u20137', label: 'Teach', detail: 'Where the close sits in the call, the assumptive close and the two-option close, and the one rule: ask, then be quiet and let them answer.' },
            { time: '7\u201313', label: 'Drill', detail: 'Closing round. Everyone delivers their close out loud, once, then stops. The silence is the exercise, not the words.' },
            { time: '13\u201315', label: 'Commit', detail: 'Ask once, clearly, then wait. Every call today.' }
          ],
          metric: 'Contact conversion rate',
          gap: 'The deck exists but its body is Part 2\u2019s content pasted in, still headed \u201cWhat make a good Hook\u201d. This lesson plan is a proposal for what should replace it.'
        }
      ]
    },
    {
      name: 'Customer Needs',
      short: 'Customer Needs',
      colour: 'blue',
      folder: 'Customer Needs',
      driveUrl: 'https://drive.google.com/drive/folders/1jruvvubW7mnOf1RMyjG2HRFBX1CjoP4h',
      unread: true,
      outcome: 'Every agent gets the facts that decide the sale and the renewal, and plays them back before pitching.',
      modules: [
        {
          title: 'The facts we never end a call without',
          label: 'The four facts',
          deckName: 'Customer Needs Part 1',
          status: 'ready',
          objective: 'Every agent asks and logs the same core facts on every call.',
          hook: 'The information you fail to get in the first three minutes is the information the retention team will be guessing at in three weeks.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a set of notes that tells the next person nothing. That was a real call that went fine.' },
            { time: '2\u20137', label: 'Teach', detail: 'The core four: what they feed now, how the dog eats, the household and who does the feeding, and what made them look at us today. Each one changes something later \u2014 the next few mornings take one each.' },
            { time: '7\u201312', label: 'Drill', detail: 'Pairs, ninety seconds each way. Get all four without it sounding like a form.' },
            { time: '12\u201315', label: 'Commit', detail: 'All four in the notes on every sale today. Nothing else changes this week.' }
          ],
          metric: 'Field completeness on current food and eating type'
        },
        {
          title: 'Asking without interrogating',
          label: 'Ask, don\u2019t quiz',
          deckName: 'Customer Needs Part 2',
          status: 'ready',
          objective: 'Turn the questions into a conversation the customer actually enjoys.',
          hook: 'Four questions in a row is a form. Four questions with a follow-up each is a conversation.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read the same discovery twice \u2014 once as a checklist, once as a chat. Same facts, completely different call.' },
            { time: '2\u20136', label: 'Teach', detail: 'Permission phrasing: \u201cso I get their first box right, can I ask\u2026\u201d. The one follow-up that does all the work: \u201cand how\u2019s that going?\u201d. And never two questions in one breath.' },
            { time: '6\u201312', label: 'Drill', detail: 'Worst-case role play. One of you answers everything in a single word. Two minutes each way.' },
            { time: '12\u201315', label: 'Commit', detail: 'Use \u201cand how\u2019s that going?\u201d at least three times today and notice what it opens up.' }
          ],
          metric: 'Discovery depth on QA-scored calls'
        },
        {
          title: 'What they are feeding right now',
          label: 'What they feed',
          deckName: 'Customer Needs Part 3',
          status: 'ready',
          objective: 'Every agent establishes the current food properly, including the brand where the customer knows it.',
          hook: 'This is the most useful sentence in the whole call. It sets what we recommend first and what we are allowed to promise.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'One question: what are they eating at the moment? Everything downstream depends on the answer.' },
            { time: '2\u20137', label: 'Teach', detail: 'The categories, what each one tells you about how strong the habit is, and why the brand matters as well as the type.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer plays four customers with vague answers. Get each to a usable category without putting words in their mouth.' },
            { time: '12\u201315', label: 'Commit', detail: 'Never log \u201cdog food\u201d again. Category plus brand where you have it.' }
          ],
          metric: 'Share of sales with current food logged properly'
        },
        {
          title: 'How the dog eats: easy, normal or fussy',
          label: 'Fussy or easy',
          deckName: 'Customer Needs Part 4',
          status: 'ready',
          objective: 'Every agent captures eating type and knows what each answer changes at the point of sale.',
          hook: '\u201cHe\u2019s a bit fussy\u201d is a reason to buy and a warning light in the same sentence. Most of us only hear the first half.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The fussy line. Two meanings, one sentence.' },
            { time: '2\u20137', label: 'Teach', detail: 'Easy, normal, fussy \u2014 and the one thing that changes for each: what you recommend first, how you set the expectation, and what you promise about the first week.' },
            { time: '7\u201312', label: 'Drill', detail: 'Six customer lines. Team calls easy, normal or fussy, then says the one thing that changes because of it.' },
            { time: '12\u201315', label: 'Commit', detail: 'When you hear fussy, say the plan out loud before you close. Do not leave it in the notes.' }
          ],
          metric: 'Early cancellation rate for sales flagged fussy'
        },
        {
          title: 'The household and who does the feeding',
          label: 'Who feeds them',
          deckName: 'Customer Needs Part 5',
          status: 'ready',
          objective: 'Every agent sets the plan for a household rather than for one dog in isolation.',
          hook: 'The person who does the feeding is not always the person on the phone.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask how many of them routinely find out who does the feeding. It will be very few.' },
            { time: '2\u20137', label: 'Teach', detail: 'How many dogs and who eats what. Who is home for a delivery. Freezer space. This is where the cancellations that look like \u201ctoo much hassle\u201d get prevented.' },
            { time: '7\u201312', label: 'Drill', detail: 'Two-dog household worked out loud: portions, plan, delivery day, storage. All four, no gaps.' },
            { time: '12\u201315', label: 'Commit', detail: 'Ask who does the feeding on every call today.' }
          ],
          metric: 'Share of cancellations citing inconvenience'
        },
        {
          title: 'Play it back, then write it down',
          label: 'Play it back',
          deckName: 'Customer Needs Part 6',
          status: 'ready',
          objective: 'Every agent can recap the needs in twenty seconds and leave a note the next person can act on.',
          hook: 'If you can play it back, they know you listened. If you write it down, the next person can pick up where you left off.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a note that tells the next person nothing, then one that tells them everything.' },
            { time: '2\u20137', label: 'Teach', detail: 'The twenty-second recap, then the note standard: current food, how they eat, what we recommended, the household, and anything they told you that we should remember.' },
            { time: '7\u201312', label: 'Drill', detail: 'Recap drill. Trainer reads a set of mock notes, agent delivers the twenty-second recap from them.' },
            { time: '12\u201315', label: 'Commit', detail: 'Recap out loud before every close today. It costs twenty seconds and it changes the close.' }
          ],
          metric: 'Note quality on the QA scorecard'
        }
      ]
    },
    {
      name: 'Objection Handling',
      short: 'Objections',
      colour: 'purple',
      folder: 'Objection handling',
      driveUrl: 'https://drive.google.com/drive/folders/1VItu_kGKMZ7Kai004vnVger_OtB5Osjz',
      outcome: 'Every agent has a first line for price, can keep a call alive when the customer opens cold, and has drilled the third objection.',
      modules: [
        {
          title: 'The three we are drilling, starting with Price',
          label: 'Price',
          deckName: 'Objection handling part 1',
          deckUrl: 'https://docs.google.com/presentation/d/1r2hn5pneHFjg0HJVQxeiP3OQjdkN76FJftOeh4qZCiY/edit',
          status: 'ready',
          objective: 'Every agent knows the three objections we are drilling and has a first sentence for price.',
          hook: 'There are dozens of objections. We are drilling three. Price is first, and it is the one we handle worst under pressure.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Name the three on the slide: Price, \u201cdon\u2019t want to talk\u201d, and the third one we still have not picked.' },
            { time: '2\u20137', label: 'Teach', detail: 'Why price comes up and when. Then the first sentence: state it flat, do not apologise, do not rush past it, and do not reach for a discount in the same breath.' },
            { time: '7\u201312', label: 'Drill', detail: 'Round-robin. Trainer throws price, agent answers in one sentence, straight on to the next person.' },
            { time: '12\u201315', label: 'Commit', detail: 'State price flat today, then stop talking and let them respond.' }
          ],
          metric: 'Objection rate on price, and conversion on calls where price came up first',
          gap: 'The third objection is still shown as \u201c?\u201d on the slide. Worth choosing it before this section runs.'
        },
        {
          title: 'Price recap, and \u201cI don\u2019t want to talk\u201d',
          label: 'Don\u2019t want to talk',
          deckName: 'Objection handling part 2',
          deckUrl: 'https://docs.google.com/presentation/d/188C4PBn4h5BSYA3QfUncIFKGXXdSXSUN1ixjDkI0Vy0/edit',
          status: 'ready',
          objective: 'Every agent can keep a call alive when the customer opens with \u201cI don\u2019t want to talk\u201d.',
          hook: '\u201cI don\u2019t want to talk\u201d is not a no. It is a bad moment. The only question is whether you earn ten more seconds or hand it back.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The difference between a real no and a bad moment, and how often we treat the second as the first.' },
            { time: '2\u20136', label: 'Teach', detail: 'Quick recap of the price line from Monday. Then the pattern for this one: acknowledge it, give one reason to stay, and ask a question they can answer in a single word.' },
            { time: '6\u201312', label: 'Drill', detail: 'Role play, two minutes each way. The customer opens hostile and stays hostile for the first thirty seconds.' },
            { time: '12\u201315', label: 'Commit', detail: 'Earn ten more seconds rather than apologising and hanging up.' }
          ],
          metric: 'Share of connected calls ending inside fifteen seconds'
        },
        {
          title: 'The third objection',
          label: 'The third one',
          deckName: 'Copy of Objection handling part 3',
          deckUrl: 'https://docs.google.com/presentation/d/1JTWEEbIgnBIy0-4iplhzpCwYOUmgeSC3xLR_hw2IKl8/edit',
          status: 'stub',
          objective: 'Every agent has a first line for the third objection, once we have chosen what it is.',
          hook: 'Two down, one to go. The third is the one that costs us sales quietly, because it never sounds like an objection.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Name the objection and why it is on the list.' },
            { time: '2\u20137', label: 'Teach', detail: 'Why it comes up, what it usually means underneath, and the first sentence.' },
            { time: '7\u201312', label: 'Drill', detail: 'Round-robin, then a two-minute role play each way.' },
            { time: '12\u201315', label: 'Commit', detail: 'One line to use today, and log it when it comes up so we can see how often it really does.' }
          ],
          metric: 'To set once the objection is chosen',
          gap: 'Blocked on a decision. The slide still says \u201c?\u201d and the file is called \u201cCopy of Objection handling part 3\u201d. My suggestion is the commitment or contract worry, since that is the objection most likely to turn into a cancellation after the call rather than a no on it.'
        }
      ]
    },
    {
      name: 'Product & Food Variants',
      short: 'Product & Food',
      colour: 'teal',
      folder: 'Product & Food Variants',
      driveUrl: 'https://drive.google.com/drive/folders/13PLLv08VGfoDJ8guZZFGCYr24ALzG6RD',
      outcome: 'Every agent can describe the range fast, set the right plan and portion, recommend a first recipe and get the logistics right.',
      modules: [
        {
          title: 'The range in sixty seconds',
          label: 'The range',
          status: 'planned',
          objective: 'Every agent can describe the range in under a minute with no notes.',
          hook: 'If it takes you two minutes to explain what they are buying, you have already lost the call.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Ask one agent to explain the range cold. Time it. It will be too long, and that is the lesson.' },
            { time: '2\u20137', label: 'Teach', detail: 'What the food is, how it is made, the recipes and the plans. Then the one-breath version that keeps only what is a reason to buy.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers the sixty-second version out loud, timed. Cut anything that is not a reason to buy.' },
            { time: '12\u201315', label: 'Commit', detail: 'Short version only today. Stop explaining, start matching.' }
          ],
          metric: 'Time spent on the presentation stage',
          gap: 'Blocked. Needs a confirmed product fact sheet \u2014 recipes, plans, portion sizes and delivery options. There is no Butternut product reference anywhere in this repository, and the Template deck already has a \u201cSummarise what Butternut is, 1 minute, 1 sentence\u201d slide that this session should build on.'
        },
        {
          title: 'Plans and portions',
          label: 'Portions and plans',
          status: 'planned',
          objective: 'Every agent can set the right plan and portion on the call and explain it in meals rather than grams.',
          hook: 'Grams mean nothing to a customer. Meals do.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Say a portion in grams, then say the same portion as meals a day. Same number, completely different reaction.' },
            { time: '2\u20137', label: 'Teach', detail: 'How the plan is calculated, the common bands, and how to say it so it lands. Then what to do when the customer thinks it is too much or too little food.' },
            { time: '7\u201311', label: 'Drill', detail: 'Four dogs of different sizes. Call the plan and say the line in meals.' },
            { time: '11\u201315', label: 'Commit', detail: 'State the portion in meals on every sale today.' }
          ],
          metric: 'Share of cancellations citing portion or plan size',
          gap: 'Needs the current plan tiers and how portions are calculated.'
        },
        {
          title: 'Which recipe to recommend first',
          label: 'Recipes first',
          status: 'planned',
          objective: 'Every agent recommends a first recipe on purpose rather than reading the list out.',
          hook: 'Offering a list is not a recommendation. It is asking the customer to do our job.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read the whole recipe list at speed, then ask what they would pick. Nobody knows.' },
            { time: '2\u20137', label: 'Teach', detail: 'Which recipe suits which dog and which owner, and the one sentence that turns a list into a recommendation.' },
            { time: '7\u201312', label: 'Drill', detail: 'Four dogs. Recommend a first recipe for each and justify it in one sentence.' },
            { time: '12\u201315', label: 'Commit', detail: 'Recommend, do not list.' }
          ],
          metric: 'Contact conversion rate',
          gap: 'Needs the recipe list and any guidance on which suits which dog.'
        },
        {
          title: 'Variety and why it matters',
          label: 'Variety',
          status: 'planned',
          objective: 'Every agent builds a wider box and can say why in one sentence.',
          hook: 'A narrow box is a bet that the dog likes one thing forever. A wide box gives you somewhere to go when they do not.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The narrow box is the one that comes back to us as a cancellation.' },
            { time: '2\u20137', label: 'Teach', detail: 'Why variety protects the subscription, and how to widen the box without making the call longer or sounding like an upsell.' },
            { time: '7\u201312', label: 'Drill', detail: 'Take a mock order with two recipes on it. Widen it out loud in one sentence.' },
            { time: '12\u201315', label: 'Commit', detail: 'Widen every box you build today.' }
          ],
          metric: 'Average recipes per subscription, and retention by recipe count',
          gap: 'Needs the Butternut equivalent of the recipe-variety retention cut. The figures currently in this repository are Marro.'
        },
        {
          title: 'Delivery, storage and freezer space',
          label: 'Delivery and space',
          status: 'planned',
          objective: 'Every agent agrees a delivery and storage plan the customer can actually live with.',
          hook: 'Cancellations that say \u201ctoo much hassle\u201d are almost always a fifteen-second conversation we did not have.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Hassle is not a product fault. It is a question we skipped.' },
            { time: '2\u20137', label: 'Teach', detail: 'Freezer space against plan size. Delivery days and who is home. What to offer when they have neither space nor a safe place.' },
            { time: '7\u201312', label: 'Drill', detail: 'Three households: a flat with a tiny freezer, a family of five, someone out all week. Set delivery and storage for each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Ask about freezer space before you confirm a plan.' }
          ],
          metric: 'Share of cancellations citing inconvenience',
          gap: 'Needs current delivery options and the guidance we give on freezer space.'
        }
      ]
    },
    {
      name: 'Conversion Training',
      short: 'Conversion',
      colour: 'green',
      folder: 'Conversion Training',
      driveUrl: 'https://drive.google.com/drive/folders/16kdm5gpPv4OMU0aDz88X68reH3yXKu7w',
      outcome: 'Every agent can match rather than list, create a reason to act now, handle the stall, and confirm a sale that sticks.',
      modules: [
        {
          title: 'Match, don\u2019t list',
          label: 'Match, don\u2019t list',
          status: 'planned',
          objective: 'Every agent presents three things maximum, each tied to something the customer actually said.',
          hook: 'Nine features is not nine reasons to buy. It is nine chances to say something they do not care about.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a nine-feature pitch at speed. Ask what they remember. It will be almost none of it.' },
            { time: '2\u20137', label: 'Teach', detail: 'Every feature must attach to something you heard while qualifying. Three is the ceiling. The sentence shape: \u201cyou said ___, so ___, which means ___ for him\u201d.' },
            { time: '7\u201312', label: 'Drill', detail: 'Trainer gives three facts from a qualifying call. Agent builds the three-feature match on the spot.' },
            { time: '12\u201315', label: 'Commit', detail: 'Three features today, each attached to something they told you.' }
          ],
          metric: 'Contact conversion rate',
          coach: 'This builds directly on SPH Part 4. If an agent cannot attach a feature to a need, the problem is in qualifying, not here.'
        },
        {
          title: 'A reason to start now',
          label: 'Urgency',
          status: 'planned',
          objective: 'Every agent can give an honest reason to start now instead of next month.',
          hook: '\u201cThink about it\u201d is what people say when starting today and starting in April feel identical.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Nothing in the pitch so far has told them why today matters. That is on us, not them.' },
            { time: '2\u20137', label: 'Teach', detail: 'Honest reasons to act now versus invented pressure, and why the invented kind shows up later as a cancellation.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone gives one honest reason to start this week. The room challenges anything that is not true.' },
            { time: '12\u201315', label: 'Commit', detail: 'Give one reason to start now on every call, and never one you would not put in writing.' }
          ],
          metric: 'Contact conversion rate, and cancellations inside the first week',
          gap: 'Needs a decision on which offers and reasons are genuinely available to agents, so nobody invents one.'
        },
        {
          title: 'The offer and the ask',
          label: 'The ask',
          status: 'planned',
          objective: 'Every agent presents the offer cleanly and asks once.',
          hook: 'A muddled offer gets a muddled answer.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Read a muddled offer out loud. Count the numbers in it. Then read a clean one.' },
            { time: '2\u20137', label: 'Teach', detail: 'How to say the offer in one breath: what they get, what it costs, what happens next. Then ask.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone says the offer in one breath. Anyone who needs two goes again.' },
            { time: '12\u201315', label: 'Commit', detail: 'One breath for the offer, one sentence for the ask.' }
          ],
          metric: 'Contact conversion rate',
          gap: 'Depends on the current offer and pricing being confirmed.'
        },
        {
          title: 'The stall: \u201cI\u2019ll think about it\u201d',
          label: 'The stall',
          status: 'planned',
          objective: 'Every agent can turn a stall into either a decision or a booked callback with a named time.',
          hook: '\u201cI\u2019ll think about it\u201d is the most expensive sentence on the call, because it feels like a maybe and behaves like a no.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'How many of last week\u2019s think-about-its came back? That is the real conversion rate of a stall.' },
            { time: '2\u20137', label: 'Teach', detail: 'What a stall usually hides \u2014 price, authority, or not enough reason. How to find out which, and how to book a real callback rather than a polite one.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. The customer stalls twice. Get to either a yes, a real no, or a callback at a named time.' },
            { time: '12\u201315', label: 'Commit', detail: 'No vague callbacks today. A day and a time, or a clean no.' }
          ],
          metric: 'Callback conversion rate'
        },
        {
          title: 'Confirming a sale that sticks',
          label: 'Make it stick',
          status: 'planned',
          objective: 'Every agent closes the call so the customer knows exactly what happens next.',
          hook: 'The sale is not the end of the call. What you say in the last ninety seconds decides whether it survives the week.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'A sale that cancels before delivery was never a sale. It was a conversation that ended too early.' },
            { time: '2\u20137', label: 'Teach', detail: 'The confirmation checklist: what is coming, when, what it costs, what to do on day one, and how to reach us. Said out loud, not left to the email.' },
            { time: '7\u201312', label: 'Drill', detail: 'Everyone delivers the confirmation in under ninety seconds. Partner ticks off the five items.' },
            { time: '12\u201315', label: 'Commit', detail: 'All five items on every sale today.' }
          ],
          metric: 'Cancellations before first delivery'
        }
      ]
    },
    {
      name: 'Demographics & Personas',
      short: 'Demographics',
      colour: 'magenta',
      folder: 'Demographics & Personas',
      driveUrl: 'https://drive.google.com/drive/folders/1TucvYlo9VtRJ14XNgzYQ_HbEZXhVao_K',
      outcome: 'Every agent can place a customer into one of the five personas in the first minute and change the hook without changing the facts.',
      modules: [
        {
          title: 'Why persona selling works, and the five we use',
          label: 'Why personas',
          deckName: 'Demographics & Customer types Part 1',
          deckUrl: 'https://docs.google.com/presentation/d/1HJ5-hioztt6e6naGWClVHWKiXdEFeBkTXD_tZWcd5ro/edit',
          status: 'ready',
          objective: 'Every agent can name the five personas and say why the same food needs five different hooks.',
          hook: 'One size fits no one. The food is identical; the problem it solves is completely different depending on who is holding the lead.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Generic pitches fall flat. Ask for a show of hands on how many openings they actually use \u2014 most will say one.' },
            { time: '2\u20138', label: 'Teach', detail: 'Why persona selling works: same great food, different hook. Then the roster \u2014 Pet Pawssessed, Canine-quibblers, The DINK-ie Dynasty, Tweed & Troubles, Barkgain Hunters. One a morning from tomorrow.' },
            { time: '8\u201312', label: 'Drill', detail: 'Read five short customer openings. The team guesses which persona each one is, with no coaching yet. Keep the answers for the end of the section.' },
            { time: '12\u201315', label: 'Commit', detail: 'Today, notice which persona each customer sounds like. Do not change anything yet, just listen for it.' }
          ],
          metric: 'Contact conversion rate by persona, once agents start tagging',
          coach: 'The deck currently writes up Pet Pawssessed in full and only names the other four. Tomorrow\u2019s deck can pick up Pet Pawssessed properly and the rest follow.'
        },
        {
          title: 'Pet Pawssessed \u2014 the Fanatics',
          label: 'The Fanatics',
          status: 'planned',
          objective: 'Every agent can match a fanatic\u2019s energy and sell the experience rather than the ingredients.',
          hook: 'The Fanatic does not own a dog. They are employed by one.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells: the Instagram account, the wardrobe, the 47 photos in thirty seconds.' },
            { time: '2\u20137', label: 'Teach', detail: 'Goal: indulge the obsession and build a lifestyle connection. Match their energy immediately. Lean on the community, the app, the bandana. Sell exclusivity \u2014 only the best for Luna \u2014 and make mealtimes an elevated experience for a family member.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. The customer opens with a photo story. Match the energy and get to the food inside ninety seconds.' },
            { time: '12\u201315', label: 'Commit', detail: 'When you hear a fanatic, use their dog\u2019s name at least three times.' }
          ],
          metric: 'Contact conversion rate on persona-tagged calls',
          gap: 'The written-up content for this persona is already inside Part 1. It needs lifting into its own deck with a role play added.'
        },
        {
          title: 'Canine-quibblers',
          label: 'The picky ones',
          status: 'planned',
          objective: 'Every agent can handle the owner who questions everything, without getting defensive.',
          hook: 'The quibbler is not being difficult. They are doing research, out loud, at you.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells, and why this persona feels like an argument when it is actually interest.' },
            { time: '2\u20137', label: 'Teach', detail: 'What they need: evidence, specifics and no overclaiming. What loses them: vague benefits and a hard close.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. The customer challenges three claims in a row. Answer each without inventing anything.' },
            { time: '12\u201315', label: 'Commit', detail: 'One specific fact instead of one general claim, on every call today.' }
          ],
          metric: 'Contact conversion rate on persona-tagged calls',
          gap: 'Persona is named in Part 1 but not written up. Needs the profile, the hook and the proof points.'
        },
        {
          title: 'The DINK-ie Dynasty',
          label: 'DINK-ie Dynasty',
          status: 'planned',
          objective: 'Every agent can sell to the dual-income household where the dog is the centre of the family.',
          hook: 'Two incomes, no children, one extremely well-fed dog.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells, and why price is rarely the real conversation here.' },
            { time: '2\u20137', label: 'Teach', detail: 'What they buy on: quality, convenience and time. What to lead with and what to leave out.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play, two minutes each way, leading on convenience rather than cost.' },
            { time: '12\u201315', label: 'Commit', detail: 'With this persona, lead on time saved rather than money spent.' }
          ],
          metric: 'Contact conversion rate on persona-tagged calls',
          gap: 'Persona is named in Part 1 but not written up.'
        },
        {
          title: 'Tweed & Troubles',
          label: 'Tweed & Troubles',
          status: 'planned',
          objective: 'Every agent can sell to the traditional owner who is sceptical of anything new.',
          hook: 'This owner has fed dogs for thirty years and has never needed a subscription to do it.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells, and why \u201cnew\u201d is a negative word with this persona.' },
            { time: '2\u20137', label: 'Teach', detail: 'What earns trust: plain language, no gimmicks, and a practical reason rather than a lifestyle one.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. Sell without using the words innovative, curated or journey.' },
            { time: '12\u201315', label: 'Commit', detail: 'Plain words only, on every call today.' }
          ],
          metric: 'Contact conversion rate on persona-tagged calls',
          gap: 'Persona is named in Part 1 but not written up.'
        },
        {
          title: 'Barkgain Hunters',
          label: 'Bargain hunters',
          status: 'planned',
          objective: 'Every agent can sell value to a price-led buyer without discounting straight away.',
          hook: 'The bargain hunter will ask for a deal. The question is what you offer before you offer money.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The tells, and why this is the persona most likely to leave when the introductory offer ends.' },
            { time: '2\u20137', label: 'Teach', detail: 'Cost per meal rather than cost per box. What to offer before a discount. And why being straight about the step-down now saves the customer later.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. The customer asks for money three times. Hold the line twice.' },
            { time: '12\u201315', label: 'Commit', detail: 'Say the price per meal before they ask for a discount.' }
          ],
          metric: 'Retention through the end of the introductory offer',
          gap: 'Persona is named in Part 1 but not written up. Also needs the current offer and the week the discount steps down.'
        }
      ]
    },
    {
      name: 'Call Listening',
      short: 'Call Listening',
      colour: 'rust',
      folder: 'Call listening',
      driveUrl: 'https://drive.google.com/drive/folders/1J_3IRyOXvlfjjD6U5Ylu5wsIASlq-MQH',
      outcome: 'Every agent can listen to a call, name what worked and what did not, and score their own.',
      modules: [
        {
          title: 'A five minute call: good, improvements, feedback',
          label: 'First call',
          deckName: 'Call listening Part 1',
          deckUrl: 'https://docs.google.com/presentation/d/1M5cwBi-m3s0ryj9hlai6ZFfVkdNh5i4VeGcBh76da2A/edit',
          status: 'ready',
          objective: 'Every agent can name one specific thing that worked and one that did not, using the four call stages as the language.',
          hook: 'You cannot copy what you cannot hear. Five minutes of someone else\u2019s call is the cheapest training we have.',
          beats: [
            { time: '0\u20131', label: 'Hook', detail: 'Set the task before you press play: listen for the four stages, not for the personality.' },
            { time: '1\u20136', label: 'Listen', detail: 'Play the five minute call. Nobody speaks. Everyone writes as they listen.' },
            { time: '6\u201311', label: 'Drill', detail: 'Good, then Improvements. One each, round the room. Name the sentence, not a general impression.' },
            { time: '11\u201315', label: 'Commit', detail: 'Feedback: one thing everybody is going to steal, and one thing everybody is going to avoid.' }
          ],
          metric: 'QA scorecard average',
          coach: 'Five minutes of audio in a fifteen minute session leaves nine minutes of talking, so keep the clip to five and stop it dead on time. Do not use a call belonging to anyone in the room.'
        },
        {
          title: 'A second call, a harder one',
          label: 'Second call',
          deckName: 'Call listening Part 2',
          deckUrl: 'https://docs.google.com/presentation/d/1ZhOGjL-zG1y-cncZdQMdM6cbwmeH2Z5PeSeddrdiDWw/edit',
          status: 'ready',
          objective: 'Every agent can find the single moment a call stopped being winnable.',
          hook: 'Weak calls rarely fail at the close. They fail somewhere in the middle, quietly, and the close is just where it becomes obvious.',
          beats: [
            { time: '0\u20131', label: 'Hook', detail: 'This one did not convert. Your job is to find the minute, not the reason.' },
            { time: '1\u20136', label: 'Listen', detail: 'Play the five minute call. Everyone writes down one timestamp.' },
            { time: '6\u201311', label: 'Drill', detail: 'Compare timestamps. They will cluster. Discuss what should have happened at that moment instead.' },
            { time: '11\u201315', label: 'Commit', detail: 'Watch for the same moment in your own calls today.' }
          ],
          metric: 'Contact conversion rate',
          coach: 'Ban the phrase \u201cthey were never going to buy\u201d. It is the fastest way to waste the session.'
        },
        {
          title: 'Scoring your own call',
          label: 'Score your own',
          status: 'planned',
          objective: 'Every agent can score one of their own calls and name one thing to change.',
          hook: 'The agents who improve fastest are the ones who listen to themselves. It is uncomfortable for about a week.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'Nobody enjoys this. Everybody who does it gets better.' },
            { time: '2\u20136', label: 'Teach', detail: 'The scorecard, four lines only: clear price, clear product, no overpromising, strong next steps. What a fail sounds like on each.' },
            { time: '6\u201313', label: 'Drill', detail: 'Everyone scores one of their own calls from this week, privately.' },
            { time: '13\u201315', label: 'Commit', detail: 'One line each to fix. Nobody shares their score, only what they are changing.' }
          ],
          metric: 'Scorecard: clear price, clear product, no overpromising, strong next steps',
          gap: 'Needs agents to be able to pull their own recordings. Also keep scoring private \u2014 the moment it becomes a league table, people pick their easiest call.',
          sources: [{ label: 'Retention Data Plan \u2014 Stage 2: retention scorecard', href: 'd2ms-retention-data-plan.html' }]
        }
      ]
    },
    {
      name: 'Retention',
      short: 'Retention',
      colour: 'brown',
      folder: 'Retention',
      driveUrl: 'https://drive.google.com/drive/folders/1iSkYvmDOjFu63IEiOSGCvy7JIoX1AkQM',
      outcome: 'Every agent sets expectations that survive the first week, and knows what to offer instead of a discount.',
      modules: [
        {
          title: 'Where we actually lose customers',
          label: 'Where we lose',
          status: 'planned',
          objective: 'Every agent can say where and when customers leave, from real numbers rather than instinct.',
          hook: 'Most of the customers we lose were lost on the call that sold them, not on the day they cancelled.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'The shape of churn: how many leave in the first week, the peak day, and the second wave when the introductory offer ends.' },
            { time: '3\u20138', label: 'Teach', detail: 'The top cancellation reasons in order, and which of them are set on our call rather than in the kitchen.' },
            { time: '8\u201313', label: 'Drill', detail: 'Predict then reveal. The team ranks the reasons on the board, then sees the real order. The gap is the discussion.' },
            { time: '13\u201315', label: 'Commit', detail: 'Nothing behavioural today. Today is about knowing the battlefield.' }
          ],
          metric: 'Cancellation rate in the first seven days',
          gap: 'Blocked. Needs Butternut cancellation reasons and timings. Every churn figure currently in this repository is Marro, so it cannot be used here without a Butternut equivalent.',
          sources: [{ label: 'Pause Tracker \u2014 the Marro equivalent of this analysis', href: 'd2ms-retention-pause-tracker.html' }]
        },
        {
          title: 'Setting it up so it survives week one',
          label: 'Set it up right',
          status: 'planned',
          objective: 'Every agent sets an expectation on the call that matches what actually happens.',
          hook: '\u201cHe\u2019ll love it\u201d is the most expensive sentence on the call, because it sets a finish line we do not control.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The sentence, and what it costs us. We are not selling a verdict.' },
            { time: '2\u20137', label: 'Teach', detail: 'How long a food change actually takes, what to say about the first few days, and the difference between promising the process and promising the outcome.' },
            { time: '7\u201312', label: 'Drill', detail: 'Four dogs on four different current foods. Say the expectation line for each.' },
            { time: '12\u201315', label: 'Commit', detail: 'Promise the process and our support today. Never the dog\u2019s verdict.' }
          ],
          metric: 'Cancellations citing the dog not eating',
          gap: 'Needs the Butternut transition guidance. The transition tracks in this repository are Marro and cat-specific.'
        },
        {
          title: 'The first box and the first week',
          label: 'First week',
          status: 'planned',
          objective: 'Every agent can talk a customer through the first week before it happens.',
          hook: 'The first box is the whole subscription. Everything after it is a habit.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'What the customer is actually worried about on delivery day, and how little of it we address on the call.' },
            { time: '2\u20137', label: 'Teach', detail: 'What to tell them about day one, what to tell them about day five, and the one thing to say about what to do if it is not going well.' },
            { time: '7\u201312', label: 'Drill', detail: 'Deliver the first-week walkthrough in ninety seconds. Partner ticks off the points.' },
            { time: '12\u201315', label: 'Commit', detail: 'Walk through the first week on every sale today.' }
          ],
          metric: 'Cancellations in the first seven days',
          gap: 'Needs the Butternut first-week guidance and whatever the customer is sent after ordering.'
        },
        {
          title: 'Save it, don\u2019t lose it',
          label: 'Save, don\u2019t lose',
          status: 'planned',
          objective: 'Every agent knows what to offer instead of money when a customer wants to leave.',
          hook: 'A discount does not fix a food problem. It just makes the same problem cheaper.',
          beats: [
            { time: '0\u20132', label: 'Hook', detail: 'The line, said once. It does most of the work on its own.' },
            { time: '2\u20137', label: 'Teach', detail: 'The ladder of things to offer before money: a recipe change, a plan change, a delivery date shift, a pause instead of a cancellation. And when a discount genuinely is the right answer.' },
            { time: '7\u201312', label: 'Drill', detail: 'Role play. The customer asks for money in week one. Get to something other than a discount.' },
            { time: '12\u201315', label: 'Commit', detail: 'Log what you offered instead of a discount. That log is the data we do not have yet.' }
          ],
          metric: 'Saves as a share of cancellation requests',
          gap: 'Needs the agreed save ladder and what agents are actually authorised to offer.',
          sources: [{ label: 'Transition & Texture deck \u2014 the Marro offer ladder, as a model', href: 'transition-texture-training-deck.html' }]
        },
        {
          title: 'When the introductory offer ends',
          label: 'The step down',
          status: 'planned',
          objective: 'Every agent pre-sells the price step-up on the first call so it is not a surprise later.',
          hook: 'The second wave of cancellations is not a pricing problem. It is a disclosure problem from eight weeks earlier.',
          beats: [
            { time: '0\u20133', label: 'Hook', detail: 'Every customer who left over the price step-up was told the price on day one \u2014 just not the whole price.' },
            { time: '3\u20138', label: 'Teach', detail: 'When the step-up lands, what the number becomes, and how to say it on the first call in one sentence without killing the sale.' },
            { time: '8\u201313', label: 'Drill', detail: 'Everyone delivers the step-up sentence, then handles \u201cthat\u2019s a big jump\u201d.' },
            { time: '13\u201315', label: 'Commit', detail: 'Say it on every sale. A customer who knew is a customer who stays.' }
          ],
          metric: 'Retention either side of the introductory offer ending',
          gap: 'Blocked. Needs the current introductory offer, the price it steps up to, and exactly which week that happens.'
        }
      ]
    }
  ]
};

const OPEN_QUESTIONS = [
  {
    week: 'Which brand',
    blocker: true,
    question: 'Is this programme for Butternut Box, for Marro, or for both?',
    why: 'Your decks are Butternut \u2014 the Demographics deck says so and all five personas are dog owners. But every piece of training material and every churn number already in this repository is Marro, the cat subscription. I have rewritten the plans in dog language, but the Product and Retention sections need Butternut facts and Butternut churn data before those decks can be written. This is the single biggest thing to settle.'
  },
  {
    week: 'Customer Needs',
    blocker: true,
    question: 'Can you paste the titles of the six Customer Needs decks, or share that folder again?',
    why: 'Drive would not return the individual file links for that folder, so it is the one section where I could not read the decks. Those six lesson plans are therefore guesses, unlike the rest.'
  },
  {
    week: 'Duplicates and stubs',
    blocker: true,
    question: 'Three decks need attention: SPH Part 4 and Part 5 both contain Part 2\u2019s content, and Objection handling Part 3 is unwritten.',
    why: 'SPH Parts 4 and 5 have the right titles \u2014 Qualifying and Finding the Fix, and Closing \u2014 but the body is Part 2 pasted in, both still headed \u201cWhat make a good Hook\u201d. Those are two of your five SPH mornings, so they are the first thing to fix.'
  },
  {
    week: 'Objection Handling',
    blocker: true,
    question: 'What is the third objection? The slides still say \u201c?\u201d.',
    why: 'My suggestion is the commitment or contract worry, because that is the objection most likely to turn into a cancellation after the call rather than a no on it. But it is your call and the deck cannot be finished without it.'
  },
  {
    week: 'Housekeeping',
    question: 'Two files need renaming or deleting: \u201cCopy of Customer Needs Part 6\u201d and \u201cCopy of Objection handling part 3\u201d.',
    why: 'The Customer Needs one looks like a straight duplicate of Part 6. The Objection handling one is your only Part 3, so it just needs the \u201cCopy of\u201d taken off the name.'
  },
  {
    week: 'Housekeeping',
    question: 'Leftover template content is still in most decks \u2014 shall I list it for you to clear?',
    why: 'Several decks still carry the template slides \u201cWHERE DOES STAMINA COME FROM?\u201d, \u201cBe Prepared!\u201d, \u201cHave you heard of us before? GAME ON:\u201d and \u201cSummarise what Butternut is\u201d. Speaker notes also carry \u201cAutomate Revenue Waterfall \u2026 find out stephen\u201d, \u201cStephen colours \u2014 check last week vs period to date\u201d, and a finance note about Box 1 and Box 2 average price per order that belongs in a trading review. Full list is in assets/drive-inventory.md.'
  },
  {
    week: 'Section lengths',
    question: 'Are my proposed counts right \u2014 Product & Food 5, Conversion 5, Retention 5, Demographics 6, Call Listening 3?',
    why: 'Demographics is 6 because Part 1 names five personas, so one morning each plus the intro. Call Listening is 3 because you have two and mentioned wanting three. The other three sections are empty, so those counts are mine and they set the finish date.'
  },
  {
    week: 'Overlap',
    question: 'SPH Parts 2 to 5 are the four call stages. Should Conversion Training build on those rather than repeat them?',
    why: 'Your SPH folder already covers Intro, Hook, Qualifying and Closing. I have written Conversion as the next layer \u2014 matching, urgency, the offer, the stall, and confirming the sale \u2014 so nothing is taught twice. Worth a sanity check.'
  },
  {
    week: 'Order',
    question: 'I have put the three finished sections first so training can start immediately. Does that work?',
    why: 'SPH, Customer Needs and Objection Handling are 14 sessions, which is three and a half weeks of running from decks that already exist. That buys time to write Product & Food before it is needed.'
  },
  {
    week: 'Content facts',
    question: 'Still outstanding: the product fact sheet, the current offer and the week the price steps up.',
    why: 'Eight of the planned decks reference one of these. The pricing numbers may already be inside your Objection handling Part 1 deck \u2014 if so, sending them over unblocks Product, Conversion and Retention at the same time.'
  },
  {
    week: 'Call recordings',
    question: 'Which recordings can we use, and can agents pull their own?',
    why: 'Both Call Listening decks are built around a five minute clip, and the third one I have proposed asks agents to score themselves.'
  },
  {
    week: 'Start date',
    question: 'Still starting Monday 24 August?',
    why: 'Monday 31 August is the summer bank holiday, so week two loses a morning. The chart flags it in red.'
  }
];
