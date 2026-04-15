// Artifact data for Fossil Frenzy
// Each artifact has: id, name, rarity, fragments (1 = whole item), fragmentNames, flavorText, researchReport, currencyReward, emoji

const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
};

const RARITY_CONFIG = {
  [RARITY.COMMON]:    { color: '#8B8B8B', label: 'Common',    cleanClicks: 5,  researchTime: 30,    reward: 10,  fragments: 1 },
  [RARITY.UNCOMMON]:  { color: '#4CAF50', label: 'Uncommon',  cleanClicks: 8,  researchTime: 120,   reward: 30,  fragments: 1 },
  [RARITY.RARE]:      { color: '#2196F3', label: 'Rare',      cleanClicks: 10, researchTime: 600,   reward: 100, fragments: 2 },
  [RARITY.EPIC]:      { color: '#9C27B0', label: 'Epic',      cleanClicks: 12, researchTime: 1800,  reward: 350, fragments: 3 },
  [RARITY.LEGENDARY]: { color: '#FF9800', label: 'Legendary', cleanClicks: 15, researchTime: 7200,  reward: 1000, fragments: 4 },
};

const LAYERS = [
  { name: 'Topsoil',   depth: 0, rows: 4,  color: '#8B6914', clicksToBreak: 1, rarityWeights: { common: 80, uncommon: 18, rare: 2, epic: 0, legendary: 0 } },
  { name: 'Clay',      depth: 1, rows: 4,  color: '#A0522D', clicksToBreak: 2, rarityWeights: { common: 50, uncommon: 35, rare: 12, epic: 3, legendary: 0 } },
  { name: 'Limestone', depth: 2, rows: 4,  color: '#C4B078', clicksToBreak: 3, rarityWeights: { common: 20, uncommon: 30, rare: 35, epic: 13, legendary: 2 } },
  { name: 'Granite',   depth: 3, rows: 4,  color: '#696969', clicksToBreak: 5, rarityWeights: { common: 5, uncommon: 15, rare: 30, epic: 35, legendary: 15 } },
  { name: 'Obsidian',  depth: 4, rows: 4,  color: '#1a1a2e', clicksToBreak: 8, rarityWeights: { common: 0, uncommon: 5, rare: 15, epic: 40, legendary: 40 } },
];

const ARTIFACTS = [
  // === COMMON (found whole) ===
  {
    id: 'pizza_fossil',
    name: 'Fossilized Pizza Slice',
    rarity: RARITY.COMMON,
    emoji: '\u{1F355}',
    flavorText: 'Pepperoni preserved perfectly for 65 million years. Still not as old as the pizza in your fridge.',
    researchReport: 'Carbon dating confirms this is from the late Cretaceous period. The cheese has achieved a state of matter unknown to modern science.',
  },
  {
    id: 'tv_remote',
    name: 'Ancient TV Remote',
    rarity: RARITY.COMMON,
    emoji: '\u{1F4FA}',
    flavorText: 'Still has dead batteries. Some things never change.',
    researchReport: 'Analysis reveals this remote controlled a device called a "television." Buttons are worn smooth, suggesting the original owner also could never find it.',
  },
  {
    id: 'flip_phone',
    name: 'Prehistoric Flip Phone',
    rarity: RARITY.COMMON,
    emoji: '\u{1F4F1}',
    flavorText: 'T-Rex arms were actually an evolutionary response to these tiny keyboards.',
    researchReport: 'This Nokia-brand device survived an asteroid impact. Battery still at 2 bars.',
  },
  {
    id: 'gym_card',
    name: "Caveman's Gym Membership Card",
    rarity: RARITY.COMMON,
    emoji: '\u{1F4B3}',
    flavorText: 'Never once used. Membership was non-refundable.',
    researchReport: "Records indicate this membership to 'Paleo Fitness' was purchased on January 1st. The expiration date suggests it was a New Year's resolution.",
  },
  {
    id: 'dad_mug',
    name: "Fossilized 'World's Best Dad' Mug",
    rarity: RARITY.COMMON,
    emoji: '\u{2615}',
    flavorText: "The universal artifact. Every dig site has at least one.",
    researchReport: "DNA analysis confirms the original owner was, in fact, not the world's best dad. He was however, pretty good.",
  },
  {
    id: 'rock_pet',
    name: 'Original Pet Rock',
    rarity: RARITY.COMMON,
    emoji: '\u{1FAA8}',
    flavorText: "Still alive. Pet rocks are immortal.",
    researchReport: "This is THE original pet rock from which all other pet rocks descend. It responds to the name 'Gerald.'",
  },
  {
    id: 'todo_list',
    name: 'Ancient To-Do List',
    rarity: RARITY.COMMON,
    emoji: '\u{1F4DD}',
    flavorText: 'Item 1: Invent fire. Item 2: Invent wheel. Item 3: ???. Item 4: Profit.',
    researchReport: 'Every item on this list is crossed out except the last one: "Finally relax." Historians believe this was never completed.',
  },
  {
    id: 'rubber_duck',
    name: 'Paleolithic Rubber Duck',
    rarity: RARITY.COMMON,
    emoji: '\u{1F986}',
    flavorText: 'Pre-dates rubber by about 2 million years. Material unknown.',
    researchReport: 'The original debugging tool. Cave paintings nearby show early programmers squeezing it while staring at stone tablets.',
  },

  // === UNCOMMON (found whole) ===
  {
    id: 'napoleon_hand',
    name: "Napoleon's Other Hand",
    rarity: RARITY.UNCOMMON,
    emoji: '\u{270B}',
    flavorText: 'The one that was NOT in his jacket. Much less famous.',
    researchReport: "While one hand was busy looking dramatic inside his coat, this hand was doing all the actual work. Signed letters, held maps, and once high-fived Wellington by accident.",
  },
  {
    id: 'hamlet_2',
    name: "Shakespeare's Draft of 'Hamlet 2: The Reckoning'",
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F4DC}',
    flavorText: 'To sequel, or not to sequel. That is the question.',
    researchReport: "The manuscript reveals Hamlet comes back as a ghost AND a zombie. Act 3 is entirely a chariot chase scene. Shakespeare's agent reportedly said 'Bill, I love it, but the market wants comedies.'",
  },
  {
    id: 'cleo_airpods',
    name: "Cleopatra's AirPods",
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F3A7}',
    flavorText: 'Found in the cracks of her throne. Classic.',
    researchReport: 'Last played: "Walk Like an Egyptian" by The Bangles (on repeat, 847 times). Battery level at death: 3%.',
  },
  {
    id: 'viking_gps',
    name: 'Viking GPS Device',
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F9ED}',
    flavorText: 'Recalculating... recalculating... you have arrived at Vinland.',
    researchReport: "Voice was set to 'Angry Odin.' Last search: 'nearest monastery (unraided).' Saved locations include 'Home,' 'Valhalla,' and 'That One Beach With Good Mead.'",
  },
  {
    id: 'medieval_sign',
    name: "Medieval 'Live Laugh Love' Sign",
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F3E0}',
    flavorText: 'Some things transcend time. Unfortunately.',
    researchReport: "Originally read 'Live, Laugh, Lament.' Found in a castle above what appears to be a medieval version of a Karen's kitchen.",
  },
  {
    id: 'dino_diary',
    name: "Velociraptor's Diary",
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F4D6}',
    flavorText: 'Day 1: Ate a fern. Day 2: Ate another fern. Day 3: Something big is coming.',
    researchReport: "The final entry reads: 'Today I saw the most beautiful shooting star— ' The rest of the page is blank.",
  },
  {
    id: 'yelp_review',
    name: 'First Ever Yelp Review',
    rarity: RARITY.UNCOMMON,
    emoji: '\u{2B50}',
    flavorText: 'Chiseled in stone. 1 star. "Fire was undercooked."',
    researchReport: "A scathing review of a Neanderthal restaurant: '1 star. Waited 3 hours for mammoth steak. Waiter was a literal bear. Would not recommend.' The owner responded: 'OOGA BOOGA' (translation unavailable).",
  },
  {
    id: 'sock',
    name: 'The First Lost Sock',
    rarity: RARITY.UNCOMMON,
    emoji: '\u{1F9E6}',
    flavorText: "Scientists believe all lost socks eventually end up here.",
    researchReport: "This sock appears to be the origin point of the 'Lost Sock Singularity.' All dryers on Earth are connected to this location through a quantum wormhole. The matching sock has never been found.",
  },

  // === RARE (2 fragments) ===
  {
    id: 'mona_lisa',
    name: 'Mona Lisa',
    rarity: RARITY.RARE,
    emoji: '\u{1F5BC}',
    fragmentNames: ['Left Half', 'Right Half'],
    flavorText: "She's smiling because she knows you'll never complete this set.",
    researchReport: "High-res analysis reveals she's actually smirking at a meme someone showed her just off-canvas. The original title was 'LOL Lisa.'",
  },
  {
    id: 'excalibur',
    name: 'Excalibur',
    rarity: RARITY.RARE,
    emoji: '\u{2694}',
    fragmentNames: ['Blade', 'Handle'],
    flavorText: 'The legendary sword. Some assembly required.',
    researchReport: "Inscription reads: 'Whoso pulleth this sword from this stone shall be— wait, the blade snapped off. Never mind.' Warranty card found nearby, expired 1,500 years ago.",
  },
  {
    id: 'einstein_board',
    name: "Einstein's Chalkboard",
    rarity: RARITY.RARE,
    emoji: '\u{1F4CB}',
    fragmentNames: ['Top Half', 'Bottom Half'],
    flavorText: "E = MC... wait, what does that say?",
    researchReport: "The top half contains the famous equation E=MC\u00B2. The bottom half, never before seen, continues: '...just kidding, it's actually E=MC\u00B3, but that was too scary so I went with 2.'",
  },
  {
    id: 'treasure_map',
    name: "Pirate's Treasure Map",
    rarity: RARITY.RARE,
    emoji: '\u{1F5FA}',
    fragmentNames: ['Top Half', 'Bottom Half'],
    flavorText: 'X marks the spot. The spot is a Subway restaurant.',
    researchReport: "Following the map's precise coordinates leads to a Subway in Topeka, Kansas. The 'treasure' appears to be a $5 footlong coupon (expired). Captain Blackbeard's handwriting in the margin reads: 'The meatball sub is actually really good here.'",
  },

  // === EPIC (3 fragments) ===
  {
    id: 'alien_phone',
    name: 'Ancient Alien Smartphone',
    rarity: RARITY.EPIC,
    emoji: '\u{1F4F2}',
    fragmentNames: ['Screen', 'Battery', 'Antenna'],
    flavorText: 'Runs on an OS not found in this galaxy. Still has better battery life than yours.',
    researchReport: "Lock screen shows 47,000 unread messages, all from 'Mom (Alpha Centauri).' Last app used: 'Galaxy Maps.' Browser history: 'is earth water safe to drink,' 'earth food near me,' 'how to build pyramid fast.'",
  },
  {
    id: 'trex_skateboard',
    name: 'T-Rex Skateboard',
    rarity: RARITY.EPIC,
    emoji: '\u{1F6F9}',
    fragmentNames: ['Deck', 'Trucks', 'Wheels'],
    flavorText: "Explains why their arms are so small — they were always holding the board.",
    researchReport: "Custom grip tape features tiny claw marks. The deck reads 'SKATE OR EXTINCTION' on the bottom. Fossil records suggest the T-Rex could kickflip but could never push mongo due to arm length. Tragically, no helmet was found.",
  },
  {
    id: 'time_luggage',
    name: "Time Traveler's Luggage",
    rarity: RARITY.EPIC,
    emoji: '\u{1F9F3}',
    fragmentNames: ['Suitcase', 'Lock', 'Paradox Inside'],
    flavorText: "Contains items from the future, past, and a timeline where dogs are the dominant species.",
    researchReport: "Contents include: next week's lottery numbers (smudged, of course), a newspaper from 3045 with the headline 'Humans Finally Figure Out USB-C,' and a note reading 'DON'T OPEN THIS UNTIL YOU'VE ALREADY OPENED IT.'",
  },
  {
    id: 'zeus_charger',
    name: "Zeus's Phone Charger",
    rarity: RARITY.EPIC,
    emoji: '\u{26A1}',
    fragmentNames: ['Cable', 'Adapter', 'Lightning Bolt Plug'],
    flavorText: "Charges phones instantly. Side effects include smiting.",
    researchReport: "This charger delivers approximately 1.21 gigawatts per second. The 'Lightning' connector predates Apple's by about 3,000 years. Zeus's iCloud account is still active and contains 40,000 photos of swans.",
  },

  // === LEGENDARY (4 fragments) ===
  {
    id: 'holy_grail',
    name: 'The Holy Grail (But It\'s a Thermos)',
    rarity: RARITY.LEGENDARY,
    emoji: '\u{1F3C6}',
    fragmentNames: ['Lid', 'Body', 'Handle', '"Holy" Sticker'],
    flavorText: "Keeps drinks hot for eternity. Literally.",
    researchReport: "After centuries of quests, crusades, and Indiana Jones movies, the Holy Grail turns out to be a Stanley thermos with a 'HOLY' sticker on it. Contents: still-warm coffee from 33 AD. Flavor profile: 'divine, with notes of frankincense.' 4.8 stars on Amazon.",
  },
  {
    id: 'atlantis_city_hall',
    name: 'Atlantis City Hall',
    rarity: RARITY.LEGENDARY,
    emoji: '\u{1F3DB}',
    fragmentNames: ['Foundation', 'Walls', 'Roof', 'Parking Permit'],
    flavorText: "It sank because they built it on a flood plain. Classic.",
    researchReport: "City planning documents reveal Atlantis sank due to a rejected zoning appeal. The parking permit is for a chariot, space B-12, and is expired. A sticky note on the mayor's desk reads: 'Memo: Perhaps building an underwater city on PURPOSE was not the flex we thought it was.'",
  },
  {
    id: 'first_router',
    name: "The Internet's First Router",
    rarity: RARITY.LEGENDARY,
    emoji: '\u{1F4E1}',
    fragmentNames: ['Chassis', 'Circuit Board', 'Ethernet Cable', 'Blinking Light'],
    flavorText: "Have you tried turning it off and on again? For the last 10,000 years?",
    researchReport: "This ancient device transmitted the first-ever message across the primordial internet. That message was: 'test.' The second message was: 'hello?' The third was an advertisement for woolly mammoth medication. The blinking light has not stopped since 8,000 BC. IT has been 'looking into it.'",
  },
];

// Get all artifact IDs for collection tracking
const ALL_ARTIFACT_IDS = ARTIFACTS.map(a => a.id);

// Helper to pick a random artifact based on layer rarity weights
function pickArtifactForLayer(layerIndex) {
  const layer = LAYERS[layerIndex];
  const weights = layer.rarityWeights;

  // Roll for rarity
  const roll = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity = RARITY.COMMON;

  for (const [rarity, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (roll < cumulative) {
      selectedRarity = rarity;
      break;
    }
  }

  // Pick random artifact of that rarity
  const candidates = ARTIFACTS.filter(a => a.rarity === selectedRarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Duplicate fragment reward
const DUPLICATE_FRAGMENT_REWARD = 5;
