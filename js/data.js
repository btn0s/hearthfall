// Static game data: tile defs, buildings, civs, perks, trade, names, locations.

export const MAP_W = 140, MAP_H = 96;   // world size
export const VIEW_W = 70, VIEW_H = 38;  // on-screen viewport (camera window)
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
  wall_w:   { ch: '#',  fg: '#96703f', bg: '#15100a', walk: false, hp: 60,  name: 'palisade' },
  wall_s:   { ch: '▓', fg: '#9c9c94', bg: '#121212', walk: false, hp: 150, name: 'stone wall' },
  door:     { ch: '+',  fg: '#c89b4f', bg: '#15100a', walk: true,  hp: 40,  name: 'door' },
  farm:     { ch: '≡', fg: '#7a5230', bg: '#171208', walk: true,  name: 'farm plot' },
  bed:      { ch: 'Θ', fg: '#b28457', bg: '#14100c', walk: true,  name: 'bed' }, // legacy: old saves migrate to tents
  tent:     { ch: '∩', fg: '#c8b088', bg: '#14100c', walk: true,  hp: 30,  name: 'tent' },
  cabin:    { ch: 'Λ', fg: '#d8a868', bg: '#14100c', walk: true,  hp: 60,  name: 'cabin' },
  longhouse: { ch: 'Π', fg: '#e8c8a0', bg: '#14100c', walk: true, hp: 100, name: 'longhouse' },
  campfire: { ch: '‼', fg: '#ff9030', bg: '#1a120a', walk: false, name: 'campfire' },
  post:     { ch: '⌂', fg: '#c5b573', bg: '#14120c', walk: false, hp: 80, name: 'watch post' },
  trap:     { ch: '‡', fg: '#8a93a0', bg: '#10100e', walk: true,  hp: 1, name: 'spike trap' },
  workshop: { ch: 'Ω', fg: '#c08a50', bg: '#161208', walk: false, hp: 80, name: 'workshop' },
  kitchen:  { ch: 'π', fg: '#d0a060', bg: '#161208', walk: false, hp: 80, name: 'kitchen' },
  beacon:   { ch: '☼', fg: '#ffe060', bg: '#1a140a', walk: false, hp: 200, name: 'the Beacon' },
};

// Structures fire can take hold of (stone and the beacon pyre are safe).
export const FLAMMABLE = new Set(['wall_w', 'door', 'bed', 'tent', 'cabin', 'longhouse', 'post', 'workshop', 'kitchen', 'tree', 'bush']);

// Houses sleep several settlers; occupants rest inside, out of sight.
// rest/heal are per-tick rates while sleeping within.
export const HOUSES = {
  tent:      { cap: 2, rest: 0.24, heal: 0.03 },
  cabin:     { cap: 3, rest: 0.3,  heal: 0.05 },
  longhouse: { cap: 5, rest: 0.38, heal: 0.08 },
  bed:       { cap: 1, rest: 0.3,  heal: 0.05 }, // legacy tiles mid-migration
};

// tier: commune tier required (from population). craft entries queue at the
// workshop. cat groups entries into build-menu tabs; keys are per-tab.
export const BUILD_TABS = [
  { id: 'homes',   name: 'HOMES' },
  { id: 'food',    name: 'FOOD' },
  { id: 'defense', name: 'DEFENSE' },
  { id: 'works',   name: 'WORKS' },
];
export const BUILDS = [
  { key: 'a', cat: 'homes',   id: 'tent',      name: 'Tent',       cost: { wood: 4 },            work: 14, hp: 30, tier: 1, note: 'sleeps 2' },
  { key: 'b', cat: 'homes',   id: 'cabin',     name: 'Cabin',      cost: { wood: 12, scrap: 1 }, work: 30, hp: 60, tier: 2, note: 'sleeps 3' },
  { key: 'c', cat: 'homes',   id: 'longhouse', name: 'Longhouse',  cost: { wood: 20, stone: 8 }, work: 60, hp: 100, tier: 3, note: 'sleeps 5' },
  { key: 'a', cat: 'food',    id: 'farm',      name: 'Farm plot',  cost: { wood: 1 },            work: 14, tier: 1 },
  { key: 'b', cat: 'food',    id: 'campfire',  name: 'Campfire',   cost: { wood: 3 },            work: 10, tier: 1 },
  { key: 'c', cat: 'food',    id: 'kitchen',   name: 'Kitchen',    cost: { wood: 6, stone: 2 },  work: 26, hp: 80, tier: 2 },
  { key: 'a', cat: 'defense', id: 'wall_w',    name: 'Palisade',   cost: { wood: 2 },            work: 16, hp: 60,  tier: 1 },
  { key: 'b', cat: 'defense', id: 'wall_s',    name: 'Stone wall', cost: { stone: 2 },           work: 30, hp: 150, tier: 3 },
  { key: 'c', cat: 'defense', id: 'door',      name: 'Door',       cost: { wood: 3 },            work: 12, hp: 40,  tier: 1 },
  { key: 'd', cat: 'defense', id: 'trap',      name: 'Spike trap', cost: { wood: 2, scrap: 1 },  work: 10, hp: 1, tier: 1 },
  { key: 'e', cat: 'defense', id: 'post',      name: 'Watch post', cost: { wood: 2, stone: 2 },  work: 24, hp: 80, tier: 2 },
  { key: 'a', cat: 'works',   id: 'workshop',  name: 'Workshop',   cost: { wood: 5, scrap: 2 },  work: 26, hp: 80, tier: 2, note: 'click for orders' },
  { key: 'b', cat: 'works',   id: 'beacon',    name: 'The Beacon', cost: { wood: 30, stone: 20, coin: 15 }, work: 220, hp: 200, tier: 3 },
];

// Structure hit points by tile id (repair and damage display read this).
export const STRUCT_HP = Object.fromEntries(BUILDS.filter(b => b.hp).map(b => [b.id, b.hp]));

// ---------------------------------------------------------------- the elder
// One voice guides the player: tutorial objectives, warnings, and counsel
// all come from the commune's elder. Mood drives the portrait color.
export const ELDERS = {
  tillers: 'Elder Maren',
  wardens: 'Captain Bryn',
  ratcatchers: 'Aunt Odessa',
  masons: 'Master Hewe',
};

// Idle counsel when nothing needs fixing, by season.
export const ELDER_IDLE = {
  spring: ['The thaw is kind. Plant, build, breathe.', 'Good soil, good folk. Make use of both.'],
  summer: ['Long days. Fill the stores while they last.', 'The commune hums. Keep it humming.'],
  autumn: ['Every meal we dry now is a day of winter.', 'The cold is patient. Be more so.'],
  winter: ['Endure. Spring always comes.', 'Huddle close, waste nothing.'],
};

// Crafting recipes — ordered from a built workshop, not the build menu.
export const CRAFTS = [
  { id: 'c_spear', name: 'Craft spear', cost: { wood: 3, scrap: 1 }, work: 12 },
  { id: 'c_meds',  name: 'Brew meds',   cost: { herbs: 3 },          work: 12 },
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

// Every settler is born with one trait. Effects live in game.js/world.js.
export const TRAITS = {
  brave:    { name: 'Brave',     desc: 'hits harder in melee' },
  craven:   { name: 'Craven',    desc: 'will not melee · works 25% faster' },
  hardy:    { name: 'Hardy',     desc: 'tougher than most' },
  frail:    { name: 'Frail',     desc: 'fragile · nimble hands' },
  glutton:  { name: 'Glutton',   desc: 'hungers half again as fast' },
  farmhand: { name: 'Farmhand',  desc: 'field and forage work 33% faster' },
  keeneye:  { name: 'Keen-eye',  desc: 'longer, harder arrow shots' },
  nightowl: { name: 'Night owl', desc: 'tireless after dark' },
  cheerful: { name: 'Cheerful',  desc: 'lifts the commune’s spirits' },
  grim:     { name: 'Grim',      desc: 'dampens the commune’s spirits' },
};

// ---------------------------------------------------------------- seasons
// A year is 20 days: 5 days a season, starting in spring ("winter broke").
// Winter: crops stop, bushes sleep, hunger bites harder, raids thin out.
export const SEASON_LEN = 5;
export const SEASONS = [
  { id: 'spring', name: 'Spring', ch: '❀', fg: '#8ad080' },
  { id: 'summer', name: 'Summer', ch: '☀', fg: '#ffd860' },
  { id: 'autumn', name: 'Autumn', ch: '⚘', fg: '#e0a040' },
  { id: 'winter', name: 'Winter', ch: '❄', fg: '#a8c8e8' },
];

// ---------------------------------------------------------------- raiders
// hp/dmg/bash roll [min,max]; hpDay adds floor(day/3)·that to hp. moveCd is
// ticks between steps (lower = faster). Brains live in updateRaider.
export const RAIDER_TYPES = {
  raider:     { ch: '☻', fg: '#e05040', name: 'raider',     hp: [9, 13],  hpDay: 1,   dmg: [2, 4], bash: [3, 6],   moveCd: 2 },
  brute:      { ch: 'Ø', fg: '#d07830', name: 'brute',      hp: [20, 28], hpDay: 1.5, dmg: [3, 6], bash: [10, 15], moveCd: 3 },
  skirmisher: { ch: '§', fg: '#d090d0', name: 'skirmisher', hp: [7, 10],  hpDay: 0.5, dmg: [2, 3], bash: [0, 0],   moveCd: 1 },
  torcher:    { ch: '¡', fg: '#ff9030', name: 'torch-bearer', hp: [8, 12], hpDay: 0.5, dmg: [1, 3], bash: [0, 0],  moveCd: 2 },
  warlord:    { ch: '☠', fg: '#ff4060', name: 'warlord',    hp: [42, 52], hpDay: 2,   dmg: [4, 7], bash: [8, 12],  moveCd: 2 },
};

export const WARLORD_NAMES = ['Red Garrick', 'Mother Krail', 'The Tollman', 'Iron Betha', 'Old Vane', 'Sarn the Lean'];

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
// max > 1 = repeatable: each level bought again at the same cost.
export const PERKS = [
  { id: 'larder',     name: 'Deep Larder',     cost: 3, max: 3, desc: '+20 starting food / level' },
  { id: 'armory',     name: 'Old Armory',      cost: 3, max: 2, desc: '+2 starting weapons / level' },
  { id: 'medicine',   name: 'Field Medicine',  cost: 2, max: 2, desc: '+2 starting meds / level' },
  { id: 'maps',       name: 'Scout Maps',      cost: 3, desc: '3 extra sites known + an easy cache' },
  { id: 'friends',    name: 'Trader Friends',  cost: 4, desc: 'Trader prices 20% kinder' },
  { id: 'timber',     name: 'Seasoned Timber', cost: 4, desc: 'Walls 20% tougher, every run' },
  { id: 'greenthumb', name: 'Green Thumb',     cost: 5, max: 3, desc: 'Crops grow 10% faster / level' },
  { id: 'fifth',      name: 'Fifth Settler',   cost: 6, desc: 'One extra settler at the start' },
  { id: 'stouthearts', name: 'Stout Hearts',   cost: 4, desc: 'Higher morale; deaths cut it half as deep' },
  { id: 'ledger',     name: 'Chronicler’s Ledger', cost: 5, desc: '+25% legacy from every run' },
];

// Civs beyond the first two are earned. Any condition unlocks (old profiles
// with runs on the books keep access fast).
export const CIV_UNLOCKS = {
  ratcatchers: { desc: 'clear 5 sites (lifetime) or finish 3 runs', check: m => (m.life?.sites || 0) >= 5 || m.runs >= 3 },
  masons:      { desc: 'repel 12 raids (lifetime) or finish 4 runs', check: m => (m.life?.raids || 0) >= 12 || m.runs >= 4 },
};

// ------------------------------------------------------------------ trader
// give → get. Perk 'friends' improves coin gained / discounts coin spent.
export const TRADE = [
  { give: { food: 5 },  get: { coin: 3 } },
  { give: { scrap: 3 }, get: { coin: 4 } },
  { give: { herbs: 2 }, get: { coin: 2 } },
  { give: { coin: 5 },  get: { food: 8 } },   // winter markup applied in adjustedOffer
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
  { id: 'chop', text: 'Chop 4 trees', hint: 'drag a box over trees', prog: g => [Math.min(4, g.stats.chopped || 0), 4], check: g => (g.stats.chopped || 0) >= 4, reward: { wood: 5 } },
  { id: 'farm', text: 'Build 2 farm plots', hint: 'b → FOOD a, on grass', prog: g => [Math.min(2, g.stats.farmsBuilt || 0), 2], check: g => (g.stats.farmsBuilt || 0) >= 2, reward: { food: 5 } },
  { id: 'bed', text: 'Pitch a tent', hint: 'b → HOMES a · sleeps 2', check: g => (g.stats.bedsBuilt || 0) >= 1 },
  { id: 'guard2', text: 'Train a 2nd guard', hint: 'click a name → role', check: g => g.settlers.filter(s => s.role === 'guard').length >= 2 },
  { id: 'walls', text: 'Raise 10 walls + door', hint: 'b → DEFENSE · ring camp', prog: g => [Math.min(10, g.stats.wallsBuilt || 0), 10], check: g => (g.stats.wallsBuilt || 0) >= 10, reward: { wood: 6 } },
  { id: 'raid', text: 'Survive a raid', hint: 'war-horns come at dusk', check: g => g.stats.raids >= 1, reward: { meds: 1 }, legacy: 1 },
  { id: 'exped', text: 'Send a party out', hint: 'w · pick a Low risk site', check: g => (g.stats.expeditions || 0) >= 1 },
  { id: 'tier2', text: 'Grow to 6 settlers', hint: 'food + housing draw folk', prog: g => [Math.min(6, g.settlers.length), 6], check: g => g.settlers.length >= 6, reward: { coin: 5 } },
  { id: 'meals', text: 'Cook meals', hint: 'b → FOOD c (tier II)', prog: g => [Math.min(3, g.stats.mealsCooked || 0), 3], check: g => (g.stats.mealsCooked || 0) >= 3, reward: { herbs: 2 } },
  { id: 'bandits', text: 'Burn a bandit camp', hint: 'w · hit ☻ with force', check: g => g.banditsCleared >= 1, reward: { coin: 8 }, legacy: 1 },
  { id: 'tier3', text: 'Grow to 9 settlers', hint: 'stone walls unlock', prog: g => [Math.min(9, g.settlers.length), 9], check: g => g.settlers.length >= 9, legacy: 1 },
  { id: 'day12', text: 'Survive to Day 12', hint: 'the raids grow bolder', prog: g => [Math.min(12, g.day), 12], check: g => g.day >= 12, legacy: 2 },
  { id: 'winter1', text: 'Survive first winter', hint: 'stockpile food by day 16', check: g => (g.stats.winters || 0) >= 1, legacy: 2 },
  { id: 'beacon', text: 'Light the Beacon', hint: 'click beacon · confirm · hold 3 days', check: g => !!g.beaconDay, legacy: 3 },
];

// One-time contextual tips (seen-set persists in localStorage).
export const TIPS = {
  welcome: 'Settlers work on their own — you set the plans. Drag a box on the map to give orders (chop, mine, fish...). Follow the OBJECTIVE box in the sidebar; ? for help.',
  night: 'Night falls. Settlers head indoors to rest and heal; anyone without a roof sleeps rough and recovers slowly. Pitch tents early.',
  foodlow: 'Food is running low! Build farm plots (b), harvest ripe crops, or send a party to an old farmstead (w).',
  raidwarn: 'Raiders strike at dusk today! Train guards (click names), close your walls with one door, lay spike traps outside it.',
  raid: 'RAID! Guards fight on their own — everyone else runs for the fire. Walls funnel raiders into your traps.',
  trader: 'A trader is in camp — press e. Coin from ruins and bandit camps buys food, weapons and medkits.',
  starving: 'Someone is STARVING and will die without food. Harvest crops, cook meals, or trade coin for food right now.',
  tier2: 'Tier II! New buildings unlocked: workshop (click it to order spears and medkits), kitchen (hearty meals), watch post (guards shoot arrows).',
  world: 'The world map: pick a site, Enter to muster a party. Mind the Risk line — farmsteads first, bandit camps when you are strong.',
  autumn: 'Autumn. Winter comes in 5 days: crops will stop and bushes will sleep. Stockpile food, cook meals, and mark fishing spots on the river.',
  winter: 'WINTER. Nothing grows and hunger bites harder. Live off your stores, fish the river, or trade coin for food until the thaw.',
  fish: 'Fishing spot marked. Settlers will cast here for a steady trickle of food — spots need a rest between catches, so mark several.',
  morale: 'Morale is BREAKING. Deaths, hunger and rough sleeping wear people down. Feed them well and win a fight — or someone will desert.',
  fire: 'FIRE! Torch-bearers light wooden structures; flames spread. Settlers rush to douse fires once the raid ends — stone does not burn.',
  thief: 'Skirmishers slip through open gaps and steal from your stockpile by the fire. Cut them down before they escape, or seal the walls.',
  downed: 'A settler is DOWN — alive, but helpless where they fell. Guard them while they crawl to a bed; another blow will be the end.',
  horde: 'A HORDE gathers under a warlord. This is no common raid: every spear, trap and wall matters. Fell the warlord and the rest will break.',
  scout: 'A party of ONE travels as a scout: fast, no assault, and they bring back the site’s true danger. Scout before you commit a war party.',
  beaconReady: 'The Beacon is built but unlit. Click it on the map when you are ready — lighting it draws every eye for miles, forces a raid soon, and raids hit harder (+2) until you hold 3 days.',
  beacon: 'The Beacon burns! Every eye for miles sees it — hold the commune for 3 days against what comes, and your story ends in triumph.',
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
