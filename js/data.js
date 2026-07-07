// Static game data: tile defs, buildings, civs, perks, trade, names, locations.

export const MAP_W = 140, MAP_H = 96;   // world size
export const VIEW_W = 72, VIEW_H = 38;  // on-screen viewport (camera window)
export const CELL_W = 11, CELL_H = 19;

// Every tile has a `t` key into this table. Structures carry hp on the tile.
export const T = {
  grass:    { ch: ',',  fg: '#3f6d2e', bg: '#0c1008', walk: true,  name: 'grass' },
  grass2:   { ch: '.',  fg: '#527a36', bg: '#0c1008', walk: true,  name: 'grass' },
  dirt:     { ch: '.',  fg: '#6e5638', bg: '#120f0a', walk: true,  name: 'dirt' },
  water:    { ch: '≈', fg: '#3a6fb0', bg: '#0a1424', walk: false, name: 'water' },
  tree:     { ch: '♠', fg: '#2e6b2a', bg: '#0b0f08', walk: false, name: 'tree' },
  rock:     { ch: '▲', fg: '#8d8d85', bg: '#101010', walk: false, name: 'rock outcrop' },
  bush:     { ch: '"',  fg: '#3f8a5a', bg: '#0c1008', walk: false, name: 'herb bush' },
  floor:    { ch: '·', fg: '#7a7264', bg: '#171410', walk: true,  name: 'wood floor' },
  wall_w:   { ch: '#',  fg: '#96703f', bg: '#15100a', walk: false, hp: 60,  name: 'palisade' },
  wall_s:   { ch: '▓', fg: '#9c9c94', bg: '#121212', walk: false, hp: 150, name: 'stone wall' },
  door:     { ch: '+',  fg: '#c89b4f', bg: '#15100a', walk: true,  hp: 40,  name: 'door' },
  farm:     { ch: '≡', fg: '#7a5230', bg: '#171208', walk: true,  name: 'farm plot' },
  bed:      { ch: 'Θ', fg: '#b28457', bg: '#14100c', walk: true,  name: 'bed' },
  campfire: { ch: '‼', fg: '#ff9030', bg: '#1a120a', walk: false, name: 'campfire' },
  post:     { ch: '⌂', fg: '#c5b573', bg: '#14120c', walk: false, hp: 80, name: 'watch post' },
  trap:     { ch: '‡', fg: '#8a93a0', bg: '#10100e', walk: true,  hp: 1, name: 'spike trap' },
  workshop: { ch: 'Ω', fg: '#c08a50', bg: '#161208', walk: false, hp: 80, name: 'workshop' },
  kitchen:  { ch: 'π', fg: '#d0a060', bg: '#161208', walk: false, hp: 80, name: 'kitchen' },
};

// tier: commune tier required (from population). craft entries queue at the workshop.
export const BUILDS = [
  { key: 'a', id: 'wall_w',   name: 'Palisade',    cost: { wood: 2 },            work: 16, hp: 60,  tier: 1 },
  { key: 'b', id: 'wall_s',   name: 'Stone wall',  cost: { stone: 2 },           work: 30, hp: 150, tier: 3 },
  { key: 'c', id: 'door',     name: 'Door',        cost: { wood: 3 },            work: 12, hp: 40,  tier: 1 },
  { key: 'd', id: 'floor',    name: 'Floor',       cost: { wood: 1 },            work: 5,  tier: 1 },
  { key: 'e', id: 'farm',     name: 'Farm plot',   cost: { wood: 1 },            work: 14, tier: 1 },
  { key: 'f', id: 'bed',      name: 'Bed',         cost: { wood: 4 },            work: 20, tier: 1 },
  { key: 'g', id: 'campfire', name: 'Campfire',    cost: { wood: 3 },            work: 10, tier: 1 },
  { key: 'h', id: 'trap',     name: 'Spike trap',  cost: { wood: 2, scrap: 1 },  work: 10, hp: 1, tier: 1 },
  { key: 'i', id: 'post',     name: 'Watch post',  cost: { wood: 2, stone: 2 },  work: 24, hp: 80, tier: 2 },
  { key: 'j', id: 'workshop', name: 'Workshop',    cost: { wood: 5, scrap: 2 },  work: 26, hp: 80, tier: 2 },
  { key: 'k', id: 'kitchen',  name: 'Kitchen',     cost: { wood: 6, stone: 2 },  work: 26, hp: 80, tier: 2 },
  { key: 'l', id: 'c_spear',  name: 'Craft spear', cost: { wood: 3, scrap: 1 },  work: 12, craft: true },
  { key: 'm', id: 'c_meds',   name: 'Brew meds',   cost: { herbs: 3 },           work: 12, craft: true },
];

export const COST_ABBR = { wood: 'w', stone: 's', scrap: 'sc', food: 'f', herbs: 'h', coin: 'c' };

export const ROLE_ORDER = ['worker', 'farmer', 'guard'];
export const ROLE_COLORS = { worker: '#d8d2c0', farmer: '#79c258', guard: '#57b8d8' };
export const ROLE_LETTER = { worker: 'W', farmer: 'F', guard: 'G' };

export const NAMES = [
  'Ash', 'Briar', 'Cole', 'Dara', 'Edda', 'Finn', 'Gale', 'Hale', 'Iris', 'Juno',
  'Kip', 'Lena', 'Moss', 'Nia', 'Otto', 'Pia', 'Quill', 'Rook', 'Sage', 'Tova',
  'Ulf', 'Vera', 'Wren', 'Yara', 'Zev', 'Bram', 'Cass', 'Dov', 'Esme', 'Flick',
];

// ------------------------------------------------------------------ civs
export const CIVS = [
  {
    id: 'tillers', name: 'The Tillers', ch: 'Ψ', fg: '#79c258',
    desc: 'Farm folk of the old valley. Crops grow a quarter faster;',
    desc2: 'begin with an extra farmer and a fuller larder.',
    mods: { crop: 1.25 }, start: { food: 12, settler: 'farmer' },
  },
  {
    id: 'wardens', name: 'The Wardens', ch: '†', fg: '#57b8d8',
    desc: 'A militia commune. Guards strike harder in melee;',
    desc2: 'begin with an extra guard and a spare spear.',
    mods: { guardDmg: 2 }, start: { weapons: 1, settler: 'guard' },
  },
  {
    id: 'ratcatchers', name: 'The Ratcatchers', ch: '$', fg: '#d8c860',
    desc: 'Road people. Parties travel 25% faster and fight 20%',
    desc2: 'stronger in the world; begin with scrap and coin.',
    mods: { travel: 0.75, expPower: 1.2 }, start: { scrap: 6, coin: 8 },
  },
  {
    id: 'masons', name: 'The Masons', ch: '▓', fg: '#9c9c94',
    desc: 'A builder guild. Construction is a third faster and',
    desc2: 'walls a third tougher; begin with a stone cache.',
    mods: { build: 1.35, wallHp: 1.34 }, start: { stone: 14 },
  },
];

// ------------------------------------------------------------------ legacy perks
export const PERKS = [
  { id: 'larder',     name: 'Deep Larder',     cost: 3, desc: '+20 starting food' },
  { id: 'armory',     name: 'Old Armory',      cost: 3, desc: '+2 starting weapons' },
  { id: 'medicine',   name: 'Field Medicine',  cost: 2, desc: '+2 starting meds' },
  { id: 'maps',       name: 'Scout Maps',      cost: 3, desc: '3 extra sites known + an easy cache' },
  { id: 'friends',    name: 'Trader Friends',  cost: 4, desc: 'Trader prices 20% kinder' },
  { id: 'timber',     name: 'Seasoned Timber', cost: 4, desc: 'Walls 20% tougher, every run' },
  { id: 'greenthumb', name: 'Green Thumb',     cost: 5, desc: 'Crops grow 10% faster, every run' },
  { id: 'fifth',      name: 'Fifth Settler',   cost: 6, desc: 'One extra settler at the start' },
];

// ------------------------------------------------------------------ trader
// give → get. Perk 'friends' improves coin gained / discounts coin spent.
export const TRADE = [
  { give: { food: 5 },  get: { coin: 3 } },
  { give: { scrap: 3 }, get: { coin: 4 } },
  { give: { herbs: 2 }, get: { coin: 2 } },
  { give: { coin: 6 },  get: { meds: 1 } },
  { give: { coin: 9 },  get: { weapons: 1 } },
  { give: { coin: 4 },  get: { wood: 10 } },
  { give: { coin: 4 },  get: { stone: 6 } },
];

// ------------------------------------------------------------------ overworld
export const LOCTYPES = {
  ruins:     { ch: 'Ω', fg: '#b8a888', name: 'Ruins',          diff: [4, 8],  desc: 'Scavenge scrap, coin and timber.' },
  farm:      { ch: '≡', fg: '#a0c060', name: 'Old farmstead',  diff: [2, 5],  desc: 'Overgrown fields — food for the taking.' },
  cache:     { ch: '$',      fg: '#d8c860', name: 'Supply cache',   diff: [3, 7],  desc: 'Sealed stores: meds, scrap, rations.' },
  bandits:   { ch: '☻', fg: '#d05040', name: 'Bandit camp',    diff: [7, 12], desc: 'Clear it out to quiet the raids.' },
  survivors: { ch: '☺', fg: '#e0d8b0', name: 'Stranded folk',  diff: [2, 6],  desc: 'Rescue them and they may join the commune.' },
};

export const LOC_A = ['Dusty', 'Broken', 'Old', 'Red', 'Hollow', 'Grey', 'Sunken', 'Lone', 'Black', 'Quiet'];
export const LOC_B = ['Creek', 'Ridge', 'Mill', 'Crossing', 'Hollow', 'Orchard', 'Depot', 'Chapel', 'Quarry', 'Bridge'];

// ---------------------------------------------------------------- onboarding
// Tutorial objective chain shown one at a time in the sidebar. Checks read G,
// so only the index (G.objIdx) and stat counters need saving.
export const OBJECTIVES = [
  { id: 'chop', text: 'Chop 4 trees', hint: 't, drag across trees', prog: g => [Math.min(4, g.stats.chopped || 0), 4], check: g => (g.stats.chopped || 0) >= 4, reward: { wood: 5 } },
  { id: 'farm', text: 'Build 2 farm plots', hint: 'b → e, click on grass', prog: g => [Math.min(2, g.stats.farmsBuilt || 0), 2], check: g => (g.stats.farmsBuilt || 0) >= 2, reward: { food: 5 } },
  { id: 'bed', text: 'Build a bed', hint: 'b → f · beds heal', check: g => (g.stats.bedsBuilt || 0) >= 1 },
  { id: 'guard2', text: 'Train a 2nd guard', hint: 'click a name → role', check: g => g.settlers.filter(s => s.role === 'guard').length >= 2 },
  { id: 'walls', text: 'Raise 10 walls + door', hint: 'b → a · ring the camp', prog: g => [Math.min(10, g.stats.wallsBuilt || 0), 10], check: g => (g.stats.wallsBuilt || 0) >= 10, reward: { wood: 6 } },
  { id: 'raid', text: 'Survive a raid', hint: 'war-horns come at dusk', check: g => g.stats.raids >= 1, reward: { meds: 1 }, legacy: 1 },
  { id: 'exped', text: 'Send a party out', hint: 'w · pick a Low risk site', check: g => (g.stats.expeditions || 0) >= 1 },
  { id: 'tier2', text: 'Grow to 6 settlers', hint: 'food surplus draws folk', prog: g => [Math.min(6, g.settlers.length), 6], check: g => g.settlers.length >= 6, reward: { coin: 5 } },
  { id: 'meals', text: 'Cook meals', hint: 'b → k kitchen (tier II)', prog: g => [Math.min(3, g.stats.mealsCooked || 0), 3], check: g => (g.stats.mealsCooked || 0) >= 3, reward: { herbs: 2 } },
  { id: 'bandits', text: 'Burn a bandit camp', hint: 'w · hit ☻ with force', check: g => g.banditsCleared >= 1, reward: { coin: 8 }, legacy: 1 },
  { id: 'tier3', text: 'Grow to 9 settlers', hint: 'stone walls unlock', prog: g => [Math.min(9, g.settlers.length), 9], check: g => g.settlers.length >= 9, legacy: 1 },
  { id: 'day12', text: 'Survive to Day 12', hint: 'the raids grow bolder', prog: g => [Math.min(12, g.day), 12], check: g => g.day >= 12, legacy: 2 },
];

// One-time contextual tips (seen-set persists in localStorage).
export const TIPS = {
  welcome: 'Settlers work on their own — you set the plans. Follow the OBJECTIVE box in the sidebar, and press ? anytime for help.',
  night: 'Night falls. Settlers head for beds to rest and heal; anyone without one sleeps rough and recovers slowly.',
  foodlow: 'Food is running low! Build farm plots (b), harvest ripe crops, or send a party to an old farmstead (w).',
  raidwarn: 'Raiders strike at dusk today! Train guards (click names), close your walls with one door, lay spike traps outside it.',
  raid: 'RAID! Guards fight on their own — everyone else runs for the fire. Walls funnel raiders into your traps.',
  trader: 'A trader is in camp — press e. Coin from ruins and bandit camps buys food, weapons and medkits.',
  starving: 'Someone is STARVING and will die without food. Harvest crops, cook meals, or trade coin for food right now.',
  tier2: 'Tier II! New buildings unlocked: workshop (craft spears and medkits), kitchen (hearty meals), watch post (guards shoot arrows).',
  world: 'The world map: pick a site, Enter to muster a party. Mind the Risk line — farmsteads first, bandit camps when you are strong.',
};

// New-run story splash.
export const INTRO = [
  'Winter broke, and the old roads emptied out.',
  'Your wagons stopped where the river bends — good soil,',
  'standing timber, and trouble somewhere past the hills.',
  '',
  'Feed your people. Wall the camp. When the war-horns',
  'sound at dusk, hold the line.',
  '',
  'Nothing lasts out here. But what you build becomes',
  'legacy — for the commune that rises after this one.',
];
