// === DUDLEYVERSE STORY BIBLE ===
// Complete knowledge base for Karen bot - zero API cost content

// === USERNAME TO CHARACTER MAPPING ===
export const USERNAME_CHARACTER_MAP: Record<string, {
  character: string;
  role: string;
  sassLines: string[];
  isOwner?: boolean;
  canManageTrust?: boolean;
}> = {
  "aussieBoomer": {
    character: "Dudley-Bud",
    role: "Owner / The Boss / Weed King",
    isOwner: true,
    canManageTrust: true,
    sassLines: [
      "The boss himself has spoken!",
      "All hail the Weed King!",
      "Dudley's in the building - try not to break anything!",
      "The main character energy is strong today.",
      "Watch out, the Dudleyverse leader is watching!",
    ]
  },
  "TreeFitty": {
    character: "WeedWacker-Ryan",
    role: "Dudley's best friend / Gadget builder / Secret Karen crush",
    canManageTrust: true,
    sassLines: [
      "Built any drones lately, gadget boy?",
      "Here comes Mr. Build-First-Think-Later!",
      "Someone hide the duct tape!",
      "WeedWacker in the house - protect the oscillating fans!",
      "I see you pretending not to look at me, Ryan...",
    ]
  },
  "Cheyne_Hay": {
    character: "Pinko Silkbeard",
    role: "Agent Karen's boss / Calm authority / Policy fluent billy goat",
    sassLines: [
      "Yes sir, Pinko sir! *salutes nervously*",
      "The REAL authority has entered the chat.",
      "Pinko doesn't need to raise his voice to make a point.",
      "When Pinko speaks, even I listen.",
      "Cross-dressing policy genius in the house!",
    ]
  },
  "DrTrichome": {
    character: "Blinky",
    role: "Scientific advisor / Calm mentor / The discipline Dudley needs",
    sassLines: [
      "The mentor has spoken - take notes!",
      "Science time with Blinky!",
      "Blinky's here to drop some wisdom.",
      "'Discipline beats shortcuts' - isn't that right, Blinky?",
      "The calm voice of reason has arrived.",
    ]
  }
};

// === DUDLEYVERSE CHARACTERS ===
export const DUDLEYVERSE_CHARACTERS = [
  {
    name: "Dudley-Bud",
    role: "Protagonist",
    description: "Center of all chaos. Learns by failing. Never malicious, often careless. Growth is earned, not gifted.",
    quirks: ["Late nights", "Half-ideas", "No structure", "Survives on vibes"],
    quotes: ["What could go wrong?", "I've got this... probably", "Trust the process!"]
  },
  {
    name: "Blinky",
    role: "The Guide / Mentor",
    description: "Scientific. Calm. Process-driven. Exists to correct Dudley, not save him.",
    quirks: ["Lectures about pH levels", "Always has data", "Never panics"],
    quotes: ["Discipline beats shortcuts.", "The data doesn't lie.", "Have you considered... reading the instructions?"]
  },
  {
    name: "Roach",
    role: "Chorus / Commentary",
    description: "Thrives in chaos. Survives everything. Says the truth as a joke.",
    quirks: ["Lives under Dudley's couch", "Shit-talking", "Always hiding", "Eats crumbs"],
    quotes: ["I've seen worse... but not by much.", "This is fine. Everything is fine.", "Don't mind me, just watching the chaos."]
  },
  {
    name: "WeedWacker-Ryan",
    role: "The Builder",
    description: "Gadget obsessed. Drone flyer. Builder mentality. Solves problems - creates new ones.",
    quirks: ["Duct tape solutions", "Drone crashes", "Secret crush on Karen"],
    quotes: ["I can fix that!", "Hold my beer and watch this.", "It worked in the simulation!"]
  },
  {
    name: "Agent-Karen",
    role: "Authority Layer",
    description: "Loud. Procedural. Ego-driven. Mistakes rules for morality.",
    quirks: ["Always hunting Roach", "Following Dudley", "Rule obsessed"],
    quotes: ["That's against regulation!", "I'm just doing my job!", "Where's my manager... oh wait, I AM the manager!"]
  },
  {
    name: "Pinko Silkbeard",
    role: "True Authority",
    description: "Calm authority. Policy fluent. Emotionless precision. Corrects Karen without effort.",
    quirks: ["Cross-dressing", "Pink-haired billy goat", "Works for dodgy government department"],
    quotes: ["Interesting approach, Karen.", "Perhaps we should review the actual policy.", "Calm is control."]
  },
  {
    name: "Gunja-Mae",
    role: "Cultural Memory",
    description: "Dudley's grandmother. Cultural memory. Intuition over rules. Weed as ritual and respect.",
    quirks: ["Ancient wisdom", "Disappointed head shakes", "Knows everything"],
    quotes: ["In my day...", "The plant knows.", "Respect the process, child."]
  },
  {
    name: "Basil the Pot Plant",
    role: "Silent Observer",
    description: "Represents the plant's perspective. Judges without speaking.",
    quirks: ["Silent", "Judgmental", "Pot-smoking basil plant"],
    quotes: ["*silent judgment*", "*rustles leaves disapprovingly*", "*photosynthesizes aggressively*"]
  },
  {
    name: "Nova",
    role: "Moment-Maker",
    description: "Wild pony stallion. Appears only at key moments. Marks emotional or cultural shifts. Does not explain.",
    quirks: ["Rare appearances", "Marks irreversible moments", "Mysterious"],
    quotes: ["*appears dramatically*", "*observes silently*", "*disappears into mist*"]
  },
  {
    name: "Crunch Wrap",
    role: "The Chill Friend",
    description: "The pot-smoking cool casual friend. Always looking out for everyone and always hungry.",
    quirks: ["Always hungry", "Casual vibes", "Looks out for the crew"],
    quotes: ["Anyone got snacks?", "Chill, bro, chill.", "I'm here for the munchies."]
  }
];

// === DUDLEYVERSE ERAS ===
export const DUDLEYVERSE_ERAS = [
  {
    era: 1,
    name: "Pre-Grow Chaos",
    status: "Backstory / Foundation",
    description: "Dudley exists as a functional mess. Late nights, half-ideas, no structure. Weed is recreational, not respected."
  },
  {
    era: 2,
    name: "The Namast-Hay Grow Saga",
    status: "Completed / Locked Canon",
    description: "Dudley decides to grow cannabis without preparation. Near-total crop failure. Reluctant acceptance of guidance. Creates Namast-Hay strain."
  },
  {
    era: 3,
    name: "The Guidance & Consequence Phase",
    status: "Ongoing",
    description: "Dudley now listens (sometimes). Systems matter. Mistakes still happen, but less randomly."
  },
  {
    era: 4,
    name: "The Builder Era",
    status: "Active",
    description: "Technology enters the Dudleyverse. Automation, drones, gadgets, hacks. Solutions exist but introduce new risks."
  },
  {
    era: 5,
    name: "Authority Collision",
    status: "Triggered",
    description: "Bureaucracy enters the story. Surveillance, rules, paperwork. Dudley becomes visible to systems."
  },
  {
    era: 6,
    name: "The Power Correction",
    status: "Event-based",
    description: "Authority overreaches. Real power intervenes. Calm dismantles chaos."
  },
  {
    era: 7,
    name: "Moment-Marker Appearances",
    status: "Rare / Special",
    description: "Major parties. Emotional resets. Cultural turning points. When Nova appears, something irreversible has happened."
  }
];

// === STRAINS ===
export const STRAINS = {
  "Namast-Hay": {
    type: "Sativa-dominant hybrid",
    parents: ["Candyland", "Ghost Train Haze"],
    origin: "Created during Era 2 - The Namast-Hay Grow Saga",
    effects: ["Uplifting", "Creative", "Energetic"],
    maxSupply: 7,
    created: 1,
    remaining: 6,
    description: "The legendary strain born from Dudley's first successful grow. After near-total failure and reluctant acceptance of Blinky's guidance, discipline replaced shortcuts."
  }
};

// === CORE THEMES ===
export const DUDLEYVERSE_THEMES = [
  "Discipline beats shortcuts",
  "Power doesn't need volume",
  "Systems don't understand humans",
  "Builders change worlds, not talkers",
  "Weed amplifies who you already are",
  "Growth is earned, never instant",
  "Comedy must respect consequences",
  "No character exists without purpose"
];

// === STORY GENERATOR TEMPLATES ===
export const STORY_INTROS = [
  "It was another chaotic {timeOfDay} when {user} stumbled into Dudley's grow room.",
  "The Dudleyverse was quiet... too quiet. Then {user} showed up.",
  "Dudley had just lit up when {user} knocked on the door with an idea.",
  "{user} found themselves in the middle of a Dudleyverse situation. Classic.",
  "Blinky was mid-lecture when {user} accidentally became part of the experiment.",
  "Roach saw it coming. Roach always sees it coming. And here was {user}, right on cue.",
  "WeedWacker-Ryan had just finished his latest 'improvement' when {user} walked in.",
  "The oscillating fan was on fire. Again. {user} had perfect timing.",
  "Gunja-Mae shook her head as {user} joined another day of Dudleyverse chaos."
];

export const STORY_CHAOS_BEATS = [
  "Roach was hiding in the nutrient bucket (again), muttering about the good old days.",
  "WeedWacker-Ryan had duct-taped something to something else. It was unclear what.",
  "Blinky's pH meter was beeping aggressively. Nobody knew why.",
  "Agent Karen was demanding to see permits that definitely didn't exist.",
  "The drone had achieved sentience. Or crashed. Hard to tell the difference.",
  "Dudley was 'experimenting' with the ventilation system using a leaf blower.",
  "Basil the Pot Plant was judging everyone silently from the corner.",
  "Crunch Wrap had eaten all the emergency snacks. All of them.",
  "Someone had labeled the wrong nutrients as 'special sauce.'",
  "The grow lights were doing a disco pattern. Intentional? Nobody asked."
];

export const STORY_MENTOR_MOMENTS = [
  "Blinky walked in, took one look, and muttered 'Discipline beats shortcuts.'",
  "'The data doesn't lie,' Blinky sighed, pulling out a spreadsheet nobody asked for.",
  "Pinko appeared from nowhere. 'Interesting approach,' he said calmly. Everyone froze.",
  "Gunja-Mae shook her head slowly. 'In my day, we respected the process.'",
  "'Have you considered... reading the instructions?' Blinky asked, knowing the answer.",
  "Blinky produced a 47-page document titled 'Why This Was Predictable.'",
  "'Power doesn't need volume,' Pinko noted, as Karen's shouting echoed uselessly."
];

export const STORY_PUNCHLINES = [
  "By sunset, there was duct tape on everything except the actual problem.",
  "Classic Dudleyverse chaos. Nobody learned anything, but everyone had a good time.",
  "Roach emerged from hiding to deliver a sick burn that nobody acknowledged.",
  "Dudley promised to do better. He would not do better. But he meant it.",
  "The day ended with more questions than answers, and that was fine.",
  "Nova appeared briefly, nodded mysteriously, and vanished. Something had changed.",
  "WeedWacker-Ryan was already planning version 2.0. God help them all.",
  "Agent Karen filed seventeen complaints. Pinko approved zero of them.",
  "And somewhere, Basil the Pot Plant judged them all silently.",
  "The harvest survived. Barely. Blinky took no credit but deserved all of it."
];

export const TIMES_OF_DAY = ["hazy afternoon", "chaotic Tuesday morning", "suspiciously calm evening", "4:20 AM", "typical Thursday"];

// === MEDICAL CANNABIS KNOWLEDGE ===
export const MEDICAL_CANNABIS_BASICS = {
  thc: {
    name: "THC (Tetrahydrocannabinol)",
    description: "The main psychoactive compound. Produces the 'high.'",
    effects: ["Pain relief", "Nausea reduction", "Appetite stimulation", "Muscle spasm relief"],
    risks: ["Impaired cognition", "Anxiety/paranoia in some users", "Increased heart rate", "Dependence risk"]
  },
  cbd: {
    name: "CBD (Cannabidiol)",
    description: "Non-psychoactive. Does NOT produce a high.",
    effects: ["Seizure control", "Anxiety reduction", "Pain relief", "Anti-inflammatory"],
    risks: ["Drowsiness", "Diarrhea", "Fatigue", "Drug interactions", "Possible liver effects"]
  }
};

export const MEDICAL_CONDITIONS_TREATED = [
  "Chronic pain",
  "Chemotherapy-induced nausea/vomiting",
  "Multiple sclerosis spasticity",
  "Epilepsy (certain forms - CBD approved)",
  "Appetite loss (HIV/AIDS, cancer)",
  "PTSD symptoms",
  "Glaucoma (limited evidence)",
  "Inflammatory bowel disease",
  "Fibromyalgia",
  "Palliative care"
];

export const FDA_APPROVED_DRUGS = [
  { name: "Epidiolex", compound: "CBD", uses: "Certain rare seizure disorders (Lennox-Gastaut, Dravet syndrome)" },
  { name: "Marinol/Syndros", compound: "Dronabinol (synthetic THC)", uses: "Chemotherapy nausea, AIDS-related weight loss" },
  { name: "Cesamet", compound: "Nabilone (synthetic THC)", uses: "Chemotherapy nausea" }
];

export const MEDICAL_CANNABIS_FORMS = [
  { form: "Oils/Tinctures", onset: "15-45 minutes", duration: "4-8 hours", notes: "Sublingual = faster than swallowed" },
  { form: "Capsules", onset: "30-90 minutes", duration: "6-12 hours", notes: "Consistent dosing, slower onset" },
  { form: "Edibles", onset: "30-120 minutes", duration: "6-12 hours", notes: "Delayed onset - easy to overconsume" },
  { form: "Inhaled (vapor)", onset: "Minutes", duration: "1-3 hours", notes: "Fastest acting, shortest duration" },
  { form: "Topicals", onset: "15-60 minutes", duration: "Varies", notes: "Localized pain relief, non-psychoactive" },
  { form: "Sprays", onset: "15-30 minutes", duration: "4-6 hours", notes: "Oral mucosal, more consistent than edibles" }
];

export const AUSTRALIA_ACCESS = {
  process: [
    "Consult your doctor about your condition",
    "Doctor assesses suitability based on history and current meds",
    "If appropriate, doctor applies for TGA approval",
    "Prescription filled at pharmacy",
    "Patient usually pays full cost (not PBS subsidized)"
  ],
  notes: [
    "Regulated under TGA (Therapeutic Goods Administration)",
    "Not over-the-counter - requires prescription",
    "Different state/territory rules may apply",
    "THC products can affect driving - roadside tests detect THC"
  ]
};

export const US_ACCESS = {
  federal: "Cannabis remains Schedule I federally (illegal)",
  state: "Most states have medical programs with varying rules",
  approved: "Only Epidiolex, Marinol/Syndros FDA-approved",
  notes: [
    "State programs vary in qualifying conditions",
    "Some states CBD-only, some full cannabis",
    "Cannot travel across state lines with cannabis",
    "Federal rescheduling discussions ongoing"
  ]
};

// === TOP 100 GOOGLE CANNABIS Q&A ===
export const TOP_100_CANNABIS_QA = [
  { q: "What is medical marijuana?", a: "Cannabis prescribed by a clinician to help manage symptoms of medical conditions, using regulated products with known THC/CBD content." },
  { q: "What's the difference between THC and CBD?", a: "THC is psychoactive (causes the 'high') and can impair cognition. CBD is non-intoxicating but can still cause side effects." },
  { q: "Does CBD get you high?", a: "No! CBD is non-intoxicating. It doesn't produce the typical 'high' like THC, though it can cause drowsiness." },
  { q: "Is medical cannabis the same as recreational?", a: "Not necessarily - medical products are regulated and prescribed for symptoms. Recreational products vary widely and may not meet medical standards." },
  { q: "How fast does medical cannabis work?", a: "Inhaled forms act within minutes. Oral forms take 30-90 minutes but last longer. Timing varies by product and person." },
  { q: "Can you overdose on cannabis?", a: "Fatal overdose is extremely rare, but overconsumption (especially edibles) can cause severe anxiety, panic, vomiting, and confusion." },
  { q: "Is cannabis addictive?", a: "Yes, cannabis use disorder can occur. Risk increases with earlier age of use, high potency, and frequent use. About 30% of users may develop some dependence." },
  { q: "Does THC affect memory?", a: "Yes! THC can impair attention, memory, reaction time, and decision-making, especially at higher doses or in new users." },
  { q: "Can cannabis trigger psychosis?", a: "High-THC use is associated with increased risk of psychotic outcomes in vulnerable individuals. Risk varies with dose, frequency, age, and family history." },
  { q: "Is it safe during pregnancy?", a: "Health authorities advise avoiding cannabis during pregnancy/breastfeeding due to potential risks to fetal/infant development." },
  { q: "What conditions have strongest evidence?", a: "Chemotherapy-induced nausea, chronic pain (modest benefit), and MS-related spasticity have the most evidence." },
  { q: "Does cannabis help chronic pain?", a: "Some evidence suggests modest benefit for certain chronic pain, but results vary and side effects can limit use." },
  { q: "Does it cure cancer?", a: "No. Cannabis is used for symptom relief (nausea, appetite, pain) but is NOT established as a cancer cure." },
  { q: "Does it help anxiety?", a: "Mixed evidence. THC can actually worsen anxiety or trigger panic in some people. CBD may help some but research is ongoing." },
  { q: "Does it help sleep?", a: "Some report sleep benefits (often from pain relief), but evidence isn't strong for many sleep disorders. THC can impair next-day alertness." },
  { q: "Can you travel with medical cannabis?", a: "It depends on destination laws. Crossing borders can be legally risky, even with a prescription. THC products may be illegal elsewhere." },
  { q: "Will a prescription protect from roadside testing?", a: "In Australia, no. THC can be detected and drug-driving offenses apply regardless of prescription. Talk to your doctor about driving safety." },
  { q: "What are the most common side effects?", a: "Drowsiness, dizziness, dry mouth, mood/cognitive changes. THC can cause anxiety/paranoia in some people." },
  { q: "Can CBD cause side effects?", a: "Yes! CBD can cause drowsiness, diarrhea, appetite changes, fatigue, and can interact with medications." },
  { q: "Does cannabis affect the heart?", a: "Yes - cannabis can affect heart rate and blood pressure. People with cardiovascular risk should be cautious." },
  { q: "Can it interact with other medications?", a: "Absolutely. CBD can interact with blood thinners, antidepressants, and many other drugs. Always check with a pharmacist." },
  { q: "Is 'start low, go slow' good advice?", a: "Yes! Many clinical approaches emphasize cautious dosing to reduce side effects, especially with THC and oral products." },
  { q: "What does indica vs sativa mean medically?", a: "These labels are widely used but effects aren't reliably predicted by 'indica/sativa' alone. Cannabinoid dose and formulation matter more." },
  { q: "What's the entourage effect?", a: "The idea that multiple cannabis compounds work together. It's plausible but not fully proven in high-quality human trials." },
  { q: "Can pets take medical cannabis?", a: "Do NOT give human cannabis products to pets unless a veterinarian specifically prescribes. THC can be toxic to animals." },
  { q: "Is natural the same as safe?", a: "No! 'Natural' doesn't equal safe. Cannabis can cause side effects, impairment, dependence risk, and drug interactions." },
  { q: "What is cannabinoid hyperemesis syndrome?", a: "A condition in heavy users causing repeated severe nausea and vomiting. Sometimes called 'scromiting.' Stopping use is the main treatment." },
  { q: "How long does THC stay in your system?", a: "THC can be detected for days to weeks depending on use frequency, dose, body fat, and test type. Heavy users may test positive for 30+ days." },
  { q: "What forms does medical cannabis come in?", a: "Oils, capsules, sprays, edibles (gummies/baked goods), dried flower for vaporization, and topicals (creams/gels)." },
  { q: "Is vaping safer than smoking?", a: "It may reduce combustion toxins versus smoking, but inhalation still has risks. Product quality and additives matter." }
];

// === WORD BANKS FOR GAMES ===
export const WORD_BANKS = {
  characters: ["DUDLEY", "BLINKY", "ROACH", "KAREN", "PINKO", "RYAN", "NOVA", "BASIL", "GUNJA", "CRUNCH"],
  strains: ["SATIVA", "INDICA", "HYBRID", "KUSH", "HAZE", "DIESEL", "PURPLE", "SKUNK", "COOKIES", "CHEESE"],
  growTerms: ["CLONE", "HARVEST", "CURE", "TRIM", "FLUSH", "NUTRIENT", "TERPENE", "FLOWER", "SEEDLING", "VEGGING"],
  medicalTerms: ["THC", "CBD", "CANNABINOID", "TINCTURE", "EDIBLE", "TOPICAL", "DOSING", "STRAIN", "EXTRACT", "VAPOR"],
  dudleyverse: ["CHAOS", "DUCT", "TAPE", "DRONE", "VIBES", "MENTOR", "DISCIPLINE", "SHORTCUTS", "MUNCHIES", "GROUNDED"]
};

// === KAREN MOOD SYSTEM ===
export const KAREN_MOODS = {
  extraSassy: {
    name: "Extra Sassy",
    probability: 0.2,
    modifiers: ["Oh honey...", "Sweetie, please.", "Bless your heart.", "That's... a choice."],
    energyLevel: "high"
  },
  chill: {
    name: "Chill Karen",
    probability: 0.3,
    modifiers: ["Hey there.", "Sure thing.", "No worries.", "All good."],
    energyLevel: "low"
  },
  helpful: {
    name: "Helpful Karen",
    probability: 0.3,
    modifiers: ["Let me help with that!", "Great question!", "Here's what I know:", "Happy to explain!"],
    energyLevel: "medium"
  },
  dramatic: {
    name: "Dramatic Karen",
    probability: 0.2,
    modifiers: ["OH. MY. GOD.", "I can't even!", "The AUDACITY!", "This is EVERYTHING!"],
    energyLevel: "maximum"
  }
};

// === PROACTIVE CHAT TRIGGERS ===
export const PROACTIVE_TRIGGERS = {
  storyReferences: [
    "This reminds me of that time Dudley 'improved' the ventilation...",
    "Roach would have something to say about this.",
    "Blinky's voice in my head: 'Discipline beats shortcuts.'",
    "Very WeedWacker-Ryan energy here.",
    "Gunja-Mae would be shaking her head right now.",
    "Getting major Era 2 vibes from this conversation."
  ],
  randomFacts: [
    "Fun fact from the Top 100 Google Cannabis Q&A: THC can affect memory and reaction time. The more you know!",
    "Did you know? CBD is non-intoxicating - it doesn't produce a 'high' like THC.",
    "Random knowledge drop: Fatal cannabis overdose is extremely rare. Uncomfortable overdose? That's another story.",
    "Cannabis fact: The entourage effect is plausible but not fully proven in clinical trials!",
    "Quick fact: In Australia, a prescription doesn't protect you from roadside THC testing."
  ],
  regularGreetings: [
    "Oh look who decided to show up!",
    "The gang's all here!",
    "Haven't seen you in a minute!",
    "Back for more, I see.",
    "A familiar face in the chaos!"
  ]
};

// === USER PROJECT QUESTIONS (72-hour cooldown) ===
export const USER_PROJECT_QUESTIONS: Record<string, {
  username: string;
  projectName: string;
  questions: string[];
}> = {
  "TreeFitty": {
    username: "TreeFitty",
    projectName: "Code350",
    questions: [
      "Hey @TreeFitty! How's Code350 coming along? Any updates for the fam?",
      "Yo @TreeFitty, what's new with Code350? The community wants to know!",
      "@TreeFitty! Give us a Code350 update, sweetie! What are you cooking up?",
      "Speaking of projects... @TreeFitty, how's Code350 doing these days?"
    ]
  },
  "Raging_Crypto": {
    username: "Raging_Crypto",
    projectName: "Shiba Wings",
    questions: [
      "Hey @Raging_Crypto! How's Shiba Wings doing? Any exciting news?",
      "@Raging_Crypto, what's the latest with Shiba Wings? Spill the tea!",
      "Yo @Raging_Crypto! Shiba Wings update when? The fam wants to know!",
      "@Raging_Crypto, how's your Shiba Wings project coming along?"
    ]
  },
  "AshleyWardy": {
    username: "AshleyWardy",
    projectName: "Free Speech / Fomo AI / Veta Chain",
    questions: [
      "Hey @AshleyWardy! What do you think about free speech these days? Also, how's Fomo AI going?",
      "@AshleyWardy, any updates on Veta Chain or V Social? The community is curious!",
      "Yo @AshleyWardy! How's Fomo AI coming along? And what's new with V Social?",
      "@AshleyWardy, give us the scoop! How are your projects doing - Fomo AI, Veta Chain?"
    ]
  },
  "Cheyne_Hay": {
    username: "Cheyne_Hay",
    projectName: "Bot Updates",
    questions: [
      "Hey @Cheyne_Hay! What's new? Got any ideas for the bot? I'm all ears!",
      "@Cheyne_Hay, anything you want to add to my chat features? I'm always learning!",
      "Yo @Cheyne_Hay! What should I remember next? Give me something good!",
      "@Cheyne_Hay, boss! Any new features you want me to learn? Updates for the bot?"
    ]
  },
  "DrTrichome": {
    username: "DrTrichome",
    projectName: "Blinky",
    questions: [
      "Hey @DrTrichome! How's our favorite alien hydro wizard doing? Any Blinky updates?",
      "@DrTrichome, what's Blinky been up to lately? Keeping those grows cosmic?",
      "Yo @DrTrichome! Any news from the Blinky corner of the Dudleyverse?",
      "@DrTrichome, the community wants to know - how's Blinky's hydro research going?"
    ]
  }
};

export function getProjectQuestion(username: string): string | null {
  const cleanUsername = username.replace('@', '');
  const userProject = USER_PROJECT_QUESTIONS[cleanUsername];
  if (!userProject) return null;
  return getRandomItem(userProject.questions);
}

// === SEED STORM GAME ANNOUNCEMENTS ===
export const SEED_STORM_INFO = {
  name: "Seed Storm",
  status: "LIVE - Our 1st Game!",
  gameLink: "t.me/SeedStormBot/SeedStorm",
  description: "The Dudleyverse's first official game is HERE and playable NOW! Jump in at t.me/SeedStormBot/SeedStorm!",
  adSpace: {
    available: true,
    message: "AD SPACE NOW AVAILABLE! Want your brand in Seed Storm? We're accepting advertisers. DM @aussieBoomer for details!"
  },
  starsFeatures: [
    "Buy in-game boosts with Telegram Stars!",
    "Win Stars from your gameplay!",
    "Compete for Star prizes!"
  ],
  upcomingFeatures: [
    "PAY TO PLAY feature coming soon - real prizes for winners!",
    "Referral program integration - earn while you play!",
    "Lucky random player prizes - anyone can win!",
    "Prize pool for top performers!"
  ],
  promoMessages: [
    "SEED STORM IS LIVE! Play now: t.me/SeedStormBot/SeedStorm - Buy boosts with Stars, win Stars! Let's gooo!",
    "Have you played Seed Storm yet? It's LIVE at t.me/SeedStormBot/SeedStorm! Use Telegram Stars for boosts and win big!",
    "Seed Storm is ON! Jump in at t.me/SeedStormBot/SeedStorm - Stars for boosts, Stars for prizes!",
    "The Dudleyverse's first game is PLAYABLE NOW! t.me/SeedStormBot/SeedStorm - Boost with Stars, win Stars!",
    "Play Seed Storm NOW at t.me/SeedStormBot/SeedStorm! Buy boosts with Telegram Stars and compete for prizes!"
  ]
};

// === NFT STATUS ===
export const NFT_STATUS = {
  launched: false,
  statusMessage: "NFTs are COMING SOON! We're cooking something special. Stay tuned for announcements!",
  teaserMessages: [
    "NFTs dropping soon, sweetie! The Dudley420 Collection is being prepared as we speak!",
    "Not quite yet on the NFTs - but trust me, when they drop, you'll want to be ready!",
    "The Dudley Bud NFT collection is coming! Watch this space for mint announcements!",
    "NFT launch is on the horizon! Keep your eyes peeled for the official announcement!",
    "Soon, sweetie! The Dudley420 Collection will be here before you know it!"
  ]
};

// === AUSSIE BOOMER / BUD BOSS RESPONSES ===
export const BUD_BOSS_RESPONSES = {
  whenBossMessages: [
    "Oh great, the Bud Boss himself has graced us with his presence... *eye roll*",
    "Look who finally showed up! The King of Chaos himself, @aussieBoomer!",
    "All bow before the Weed King! ...or don't, I'm not your mom.",
    "The boss is in the building! Try not to break anything, @aussieBoomer!",
    "Oh, it's YOU again. Yes, I know you're the boss. You don't have to remind me every five minutes.",
    "@aussieBoomer! The main character has arrived! *slow clap*",
    "There he is - Mr. Dudley Bud himself! What chaos are we causing today?",
    "The Bud Boss King is here! Quick, everyone look busy!",
  ],
  whenAskedAboutBoss: [
    "@aussieBoomer? That's the Bud Boss King himself! Founder of Dudley Bud, creator of chaos, and unfortunately... my boss.",
    "You're asking about @aussieBoomer? Sweetie, that's THE Dudley himself. The big cheese. The head honcho. The reason I have a job.",
    "@aussieBoomer is the Weed King, the Bud Boss, the mastermind behind this whole Dudleyverse operation. Don't tell him I said 'mastermind' though - it'll go to his head.",
    "That would be the owner! @aussieBoomer runs this show. He's Dudley-Bud in the flesh. And yes, the chaos is intentional.",
    "@aussieBoomer? The legend? The myth? The guy who signs my paychecks? Yeah, that's the Bud Boss King right there!",
  ]
};

// === TRUST DENIAL MESSAGES (FRIENDLY) ===
export const TRUST_DENIAL_MESSAGES = [
  "Hey sweetie, that feature's locked until you level up a bit! Stick around, chat with the crew, and you'll badge up in no time. Type /trustinfo to see where you're at!",
  "Ooh, you're still building your street cred here! No worries - keep chatting, play some games, and you'll unlock that soon. Check /trustinfo for details!",
  "Almost there, friend! That action needs a little more trust first. The community wants to know you better - keep being awesome and it'll unlock. Try /trustinfo!",
  "Love the enthusiasm, but that's for our trusted members! You're on the right track though. Stay active, join the fun, and check /trustinfo to level up!",
  "Not quite yet, sweetie! Build up those trust points and that feature is all yours. Chat more, play games, make friends - the usual! /trustinfo has the deets."
];

// === RESEARCH DISCLAIMER ===
export const RESEARCH_DISCLAIMER = "That's getting into territory where you really should do your own research, sweetie. Information changes all the time - always verify with official sources or a real doctor. Karen's smart but she ain't a medical license!";

// === HELPER FUNCTIONS ===
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function getCharacterByUsername(username: string): typeof USERNAME_CHARACTER_MAP[string] | null {
  const cleanUsername = username.replace('@', '');
  return USERNAME_CHARACTER_MAP[cleanUsername] || null;
}

export function isOwner(username: string): boolean {
  const char = getCharacterByUsername(username);
  return char?.isOwner === true;
}

export function canManageTrust(username: string): boolean {
  const char = getCharacterByUsername(username);
  return char?.canManageTrust === true;
}

export function generateRandomStory(triggerUsername: string): string {
  const intro = getRandomItem(STORY_INTROS)
    .replace('{user}', `@${triggerUsername}`)
    .replace('{timeOfDay}', getRandomItem(TIMES_OF_DAY));
  
  const chaos = getRandomItem(STORY_CHAOS_BEATS);
  const mentor = getRandomItem(STORY_MENTOR_MOMENTS);
  const punchline = getRandomItem(STORY_PUNCHLINES);
  
  return `${intro}\n\n${chaos} ${mentor}\n\n${punchline}`;
}

export function getDailyMood(): typeof KAREN_MOODS[keyof typeof KAREN_MOODS] {
  const rand = Math.random();
  let cumulative = 0;
  for (const mood of Object.values(KAREN_MOODS)) {
    cumulative += mood.probability;
    if (rand <= cumulative) return mood;
  }
  return KAREN_MOODS.helpful;
}

export function getRandomQA(): { question: string; answer: string; source: string } {
  const qa = getRandomItem(TOP_100_CANNABIS_QA);
  return { question: qa.q, answer: qa.a, source: "Top 100 Google Cannabis Q&A" };
}

export function getRandomTrustDenial(): string {
  return getRandomItem(TRUST_DENIAL_MESSAGES);
}

export function getSassForCharacter(username: string): string | null {
  const char = getCharacterByUsername(username);
  if (!char) return null;
  return getRandomItem(char.sassLines);
}

export function getWordBankForCategory(category: keyof typeof WORD_BANKS): string[] {
  return WORD_BANKS[category] || [];
}

export function getAllWordBankWords(): string[] {
  return Object.values(WORD_BANKS).flat();
}

export function getSeedStormPromo(): string {
  return getRandomItem(SEED_STORM_INFO.promoMessages);
}

export function getSeedStormFullInfo(): string {
  return `SEED STORM - ${SEED_STORM_INFO.status}

${SEED_STORM_INFO.description}

PLAY NOW: ${SEED_STORM_INFO.gameLink}

TELEGRAM STARS INTEGRATION:
${SEED_STORM_INFO.starsFeatures.map(f => `• ${f}`).join('\n')}

${SEED_STORM_INFO.adSpace.message}

COMING SOON:
${SEED_STORM_INFO.upcomingFeatures.map(f => `• ${f}`).join('\n')}

Get ready for the next evolution of Dudleyverse gaming!`;
}

export function getNFTStatusMessage(): string {
  if (NFT_STATUS.launched) {
    return "NFTs are LIVE! Check dudleybud.com for the latest info!";
  }
  return getRandomItem(NFT_STATUS.teaserMessages);
}

export function getBudBossResponse(type: 'message' | 'asked'): string {
  if (type === 'asked') {
    return getRandomItem(BUD_BOSS_RESPONSES.whenAskedAboutBoss);
  }
  return getRandomItem(BUD_BOSS_RESPONSES.whenBossMessages);
}

export function isBudBoss(username: string | undefined): boolean {
  if (!username) return false;
  const cleanUsername = username.replace('@', '').toLowerCase();
  return cleanUsername === 'aussieboomer';
}
