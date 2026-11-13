// ---------------------------------------------------------------------------
// 02_data.js — game definitions (units, buildings, techs, ages, cards, civs, biomes)
// ---------------------------------------------------------------------------
const RES = ['food', 'wood', 'coin', 'stone'];
const ANIM = { IDLE: 0, MOVE: 1, GUN: 2, SWORD: 3, WORK: 4, GATHER: 5, PIKE: 6, CANNON: 7, BOW: 8, THROW: 9, DEAD: 10, XBOW: 11, CHOP: 12, CHOP_LOG: 13 };
const CHOP_PERIOD = 1.1, CHOP_IMPACT = 0.6;
const RES_NAME = { food: 'еда', wood: 'дерево', coin: 'монеты', stone: 'камень' };
const RES_NAME_GEN = { food: 'еды', wood: 'дерева', coin: 'монет', stone: 'камня' };
const RES_TITLE = { food: 'Еда', wood: 'Дерево', coin: 'Монеты', stone: 'Камень' };
// where each resource comes from / what it is for (HUD tooltips)
const RES_HELP = {
  food: { from: 'ягодные кусты, охота, ящики, мельница', use: 'поселенцы, войска, переход в новую эпоху' },
  wood: { from: 'деревья (рубка леса), ящики', use: 'дома и почти все здания, лучники, пушки' },
  coin: { from: 'серебряные рудники, плантация, торговые посты', use: 'войска, технологии, эпохи III–V' },
  stone: { from: 'каменоломни — серые скалы с тёсаными блоками', use: 'бастионы, церковь, арсенал, литейный двор, укрепления, эпохи IV–V' },
};
const PRICE_BASE = { food: 100, wood: 100, stone: 120 };

const PLAYER_COLORS = [
  { name: 'Синий', hex: 0x2f6fd6 },
  { name: 'Красный', hex: 0xc8352b },
  { name: 'Жёлтый', hex: 0xe2b42c },
  { name: 'Бирюзовый', hex: 0x24a398 },
];
const GAIA = -1;

// base gather rates (resource per second)
const GATHER = { berry: 0.65, hunt: 1.0, farm: 0.62, wood: 0.56, mine: 0.66, quarry: 0.6, plantation: 0.6, crate: 5 };
const XP_PER_RES = 0.2;

const MAP_SIZES = {
  medium: { name: 'Средняя', size: 240 },
  large: { name: 'Большая', size: 320 },
  huge: { name: 'Огромная', size: 400 },
};

const DIFFICULTY = {
  easy:   { name: 'Лёгкий',  gather: 0.7,  think: 3.0, maxVill: 28, maxArmy: 16, firstAttack: 900, wave: 7,  waveGrow: 3, ageMinTime: [0, 300, 900, 1500, 2100], counter: false, techs: 0.3 },
  normal: { name: 'Средний', gather: 0.92, think: 1.6, maxVill: 48, maxArmy: 40, firstAttack: 600, wave: 11, waveGrow: 4, ageMinTime: [0, 200, 600, 1080, 1500], counter: true, techs: 0.7 },
  hard:   { name: 'Сложный', gather: 1.05, think: 1.0, maxVill: 62, maxArmy: 90, firstAttack: 450, wave: 14, waveGrow: 5, ageMinTime: [0, 0, 0, 0, 0], counter: true, techs: 1 },
  expert: { name: 'Эксперт', gather: 1.25, think: 0.6, maxVill: 75, maxArmy: 140, firstAttack: 360, wave: 16, waveGrow: 6, ageMinTime: [0, 0, 0, 0, 0], counter: true, techs: 1 },
};

// ---------------------------------------------------------------- civilizations
const CIVS = {
  britain: {
    name: 'Британия', adj: 'британцы',
    bonus: 'Каждый построенный дом приводит бесплатного поселенца. Уникальный юнит — длиннолучник.',
    ranged: 'longbowman', unique: 'longbowman', palette: { roof: 0x6b3a2e, wall: 0xd9cfb8, trim: 0x3e2b20 },
  },
  france: {
    name: 'Франция', adj: 'французы',
    bonus: 'Поселенцы-«лесные бегуны»: на 10% быстрее собирают и на 50% крепче, но стоят 120 еды. Уникальный юнит — кирасир.',
    ranged: 'crossbowman', unique: 'cuirassier', palette: { roof: 0x3f4a63, wall: 0xe3dcc8, trim: 0x2b2f3a },
  },
  spain: {
    name: 'Испания', adj: 'испанцы',
    bonus: 'Опыт для поставок из метрополии копится на 25% быстрее. Уникальный юнит — роделеро.',
    ranged: 'crossbowman', unique: 'rodelero', palette: { roof: 0xa8552f, wall: 0xe8d9b5, trim: 0x5a3a24 },
  },
  russia: {
    name: 'Россия', adj: 'русские',
    bonus: 'Поселенцы и пехота обучаются на 30% быстрее, поселенцы стоят 90 еды. Уникальный юнит — стрелец.',
    ranged: 'strelet', unique: 'strelet', palette: { roof: 0x2f5a3c, wall: 0xcdb48c, trim: 0x4a3322 },
  },
};

// ---------------------------------------------------------------- units
// cls tags: villager, hero, infantry, heavyInf, lightInf, cavalry, heavyCav, lightCav, artillery, animal, huntable, guardian, wagon
const UNITS = {
  settler: {
    name: 'Поселенец', cls: ['villager'], hp: 150, speed: 4.0, los: 14, pop: 1, cost: { food: 100 }, time: 15, age: 1, at: ['tc'],
    melee: { dmg: 6, rof: 1.5, range: 1.4, anim: 'work' }, siege: 10, armor: {}, gather: true, build: true, radius: 0.45, height: 1.8,
    model: 'settler', desc: 'Собирает ресурсы, строит и чинит здания.', hotkey: 'Q',
  },
  explorer: {
    name: 'Исследователь', cls: ['hero'], hp: 450, speed: 5.6, los: 24, pop: 0, cost: null, age: 1,
    ranged: { dmg: 14, range: 10, rof: 2, proj: 'pistol', anim: 'gun' }, melee: { dmg: 22, rof: 1.4, range: 1.7, anim: 'sword' }, siege: 14,
    armor: { ranged: 0.3, melee: 0.1 }, hero: true, buildTP: true, radius: 0.5, height: 1.85, model: 'explorer',
    desc: 'Разведчик и герой. Собирает сокровища и строит торговые посты. При ранении теряет сознание — выкуп в городском центре.',
  },
  musketeer: {
    name: 'Мушкетёр', cls: ['infantry', 'heavyInf'], hp: 160, speed: 4.0, los: 16, pop: 1, cost: { food: 75, coin: 25 }, time: 20, age: 2, at: ['barracks', 'fort'],
    ranged: { dmg: 24, range: 12, rof: 3, proj: 'musket', anim: 'gun' }, melee: { dmg: 14, rof: 1.5, range: 1.7, anim: 'pike' }, siege: 16,
    armor: { ranged: 0.2 }, bonus: { cavalry: 2 }, radius: 0.45, height: 1.95, model: 'musketeer', hotkey: 'Q',
    desc: 'Тяжёлая пехота с мушкетом и штыком. Сильна против кавалерии.',
  },
  pikeman: {
    name: 'Пикинёр', cls: ['infantry', 'heavyInf'], hp: 150, speed: 4.3, los: 14, pop: 1, cost: { food: 50, wood: 50 }, time: 15, age: 2, at: ['barracks', 'fort'],
    melee: { dmg: 12, rof: 1.5, range: 2.4, anim: 'pike' }, siege: 20, armor: { ranged: 0.2 }, bonus: { cavalry: 3, building: 1.5 },
    radius: 0.45, height: 1.9, model: 'pikeman', hotkey: 'W', desc: 'Дешёвая пехота ближнего боя. Втрое сильнее против кавалерии.',
  },
  crossbowman: {
    name: 'Арбалетчик', cls: ['infantry', 'lightInf'], hp: 110, speed: 4.0, los: 20, pop: 1, cost: { food: 50, wood: 50 }, time: 18, age: 2, at: ['barracks', 'fort'],
    notCiv: ['britain', 'russia'], ranged: { dmg: 17, range: 18, rof: 3, proj: 'bolt', anim: 'xbow' }, melee: { dmg: 6, rof: 1.5, range: 1.4, anim: 'sword' }, siege: 8,
    armor: {}, bonus: { heavyInf: 2 }, radius: 0.45, height: 1.85, model: 'crossbowman', hotkey: 'E',
    desc: 'Лёгкая стрелковая пехота. Вдвое сильнее против тяжёлой пехоты.',
  },
  longbowman: {
    name: 'Длиннолучник', cls: ['infantry', 'lightInf'], hp: 105, speed: 4.0, los: 24, pop: 1, cost: { food: 50, wood: 55 }, time: 18, age: 2, at: ['barracks', 'fort'],
    civ: ['britain'], ranged: { dmg: 16, range: 22, rof: 2.6, proj: 'arrow', anim: 'bow' }, melee: { dmg: 6, rof: 1.5, range: 1.4, anim: 'sword' }, siege: 8,
    armor: {}, bonus: { heavyInf: 2 }, radius: 0.45, height: 1.85, model: 'longbowman', hotkey: 'E',
    desc: 'Британский лучник с огромной дальностью. Силён против тяжёлой пехоты.',
  },
  strelet: {
    name: 'Стрелец', cls: ['infantry', 'lightInf'], hp: 95, speed: 4.1, los: 18, pop: 1, cost: { food: 45, coin: 25 }, time: 11, age: 2, at: ['barracks', 'fort'],
    civ: ['russia'], ranged: { dmg: 15, range: 15, rof: 3, proj: 'musket', anim: 'gun' }, melee: { dmg: 8, rof: 1.5, range: 1.6, anim: 'pike' }, siege: 12,
    armor: {}, bonus: { heavyInf: 1.75 }, radius: 0.45, height: 1.95, model: 'strelet', hotkey: 'E',
    desc: 'Дешёвый русский стрелок с бердышом. Быстро обучается, силён против тяжёлой пехоты.',
  },
  rodelero: {
    name: 'Роделеро', cls: ['infantry', 'heavyInf'], hp: 210, speed: 4.4, los: 14, pop: 1, cost: { food: 70, coin: 50 }, time: 20, age: 2, at: ['barracks', 'fort'],
    civ: ['spain'], melee: { dmg: 18, rof: 1.3, range: 1.6, anim: 'sword' }, siege: 18, armor: { ranged: 0.35 }, bonus: { lightInf: 2.5, artillery: 1.5 },
    radius: 0.45, height: 1.85, model: 'rodelero', hotkey: 'R',
    desc: 'Испанский мечник со щитом. Уничтожает лёгкую пехоту, хорошо держит стрелы и пули.',
  },
  skirmisher: {
    name: 'Застрельщик', cls: ['infantry', 'lightInf'], hp: 130, speed: 4.2, los: 22, pop: 1, cost: { food: 65, coin: 55 }, time: 22, age: 3, at: ['barracks', 'fort'],
    ranged: { dmg: 20, range: 20, rof: 3, proj: 'musket', anim: 'gun' }, melee: { dmg: 8, rof: 1.5, range: 1.6, anim: 'pike' }, siege: 10,
    armor: { ranged: 0.3 }, bonus: { heavyInf: 3, artillery: 2 }, radius: 0.45, height: 1.9, model: 'skirmisher', hotkey: 'A',
    desc: 'Лёгкая пехота с нарезным ружьём. Втрое сильнее против тяжёлой пехоты.',
  },
  grenadier: {
    name: 'Гренадер', cls: ['infantry', 'heavyInf'], hp: 170, speed: 3.9, los: 16, pop: 1, cost: { food: 80, coin: 60 }, time: 25, age: 3, at: ['barracks'],
    ranged: { dmg: 22, range: 11, rof: 3.5, proj: 'grenade', anim: 'throw', splash: 2.4 }, melee: { dmg: 14, rof: 1.5, range: 1.7, anim: 'sword' }, siege: 35,
    armor: { ranged: 0.2 }, bonus: { building: 3, artillery: 1.5 }, radius: 0.45, height: 2.05, model: 'grenadier', hotkey: 'S',
    desc: 'Метает гранаты по площади. Эффективен против зданий и скоплений.',
  },
  hussar: {
    name: 'Гусар', cls: ['cavalry', 'heavyCav'], hp: 300, speed: 7.0, los: 16, pop: 2, cost: { food: 120, coin: 80 }, time: 25, age: 2, at: ['stable', 'fort'],
    melee: { dmg: 24, rof: 1.5, range: 2.4, anim: 'sword' }, siege: 14, armor: { melee: 0.2 }, bonus: { lightInf: 1.5, artillery: 2.5, villager: 1.5 },
    radius: 0.95, height: 2.6, model: 'hussar', hotkey: 'Q', desc: 'Тяжёлая кавалерия. Сокрушает лёгкую пехоту, артиллерию и поселенцев.',
  },
  dragoon: {
    name: 'Драгун', cls: ['cavalry', 'lightCav'], hp: 260, speed: 7.2, los: 20, pop: 2, cost: { food: 100, wood: 50, coin: 60 }, time: 25, age: 3, at: ['stable', 'fort'],
    ranged: { dmg: 22, range: 12, rof: 2.6, proj: 'musket', anim: 'gun' }, melee: { dmg: 10, rof: 1.5, range: 2.2, anim: 'sword' }, siege: 10,
    armor: { ranged: 0.3 }, bonus: { heavyCav: 2.5 }, radius: 0.95, height: 2.6, model: 'dragoon', hotkey: 'W',
    desc: 'Конный стрелок. Охотник на тяжёлую кавалерию.',
  },
  cuirassier: {
    name: 'Кирасир', cls: ['cavalry', 'heavyCav'], hp: 520, speed: 6.6, los: 16, pop: 3, cost: { food: 150, coin: 150 }, time: 32, age: 3, at: ['stable', 'fort'],
    civ: ['france'], melee: { dmg: 42, rof: 1.6, range: 2.4, anim: 'sword', splash: 1.8 }, siege: 20, armor: { melee: 0.3, ranged: 0.1 },
    bonus: { lightInf: 1.5, artillery: 2.5 }, radius: 1.0, height: 2.7, model: 'cuirassier', hotkey: 'E',
    desc: 'Французская бронированная кавалерия. Бьёт по площади.',
  },
  falconet: {
    name: 'Фальконет', cls: ['artillery'], hp: 220, speed: 3.3, los: 24, pop: 4, cost: { wood: 200, coin: 200 }, time: 35, age: 3, at: ['foundry', 'fort'],
    ranged: { dmg: 60, range: 26, rof: 5, proj: 'cannon', anim: 'cannon', splash: 2.6 }, armor: { ranged: 0.6 }, bonus: { infantry: 1.5, building: 2.5, cavalry: 0.6 },
    radius: 1.1, height: 1.6, model: 'falconet', hotkey: 'Q', desc: 'Полевая пушка. Бьёт по площади: опасна для пехоты и зданий.',
  },
  mortar: {
    name: 'Мортира', cls: ['artillery'], hp: 180, speed: 2.7, los: 20, pop: 4, cost: { wood: 250, coin: 150 }, time: 35, age: 3, at: ['foundry'],
    ranged: { dmg: 140, range: 34, minRange: 6, rof: 7, proj: 'mortar', anim: 'cannon', splash: 3, buildingsOnly: true }, armor: { ranged: 0.6 },
    bonus: { building: 2 }, radius: 1.0, height: 1.4, model: 'mortar', hotkey: 'W', desc: 'Осадное орудие огромной дальности. Атакует только здания.',
  },
  culverin: {
    name: 'Кулеврина', cls: ['artillery'], hp: 230, speed: 3.0, los: 26, pop: 4, cost: { wood: 300, coin: 250 }, time: 40, age: 4, at: ['foundry'],
    ranged: { dmg: 90, range: 30, rof: 5, proj: 'cannon', anim: 'cannon' }, armor: { ranged: 0.6 }, bonus: { artillery: 4, cavalry: 0.4, infantry: 0.3, villager: 0.3 },
    radius: 1.2, height: 1.6, model: 'culverin', hotkey: 'E', desc: 'Длинноствольное орудие. Уничтожает вражескую артиллерию с большой дистанции.',
  },
  fortWagon: {
    name: 'Фургон форта', cls: ['wagon'], hp: 1500, speed: 4.2, los: 16, pop: 0, cost: null, age: 3, armor: { ranged: 0.5 }, radius: 1.2, height: 2.4,
    model: 'wagon', builds: 'fort', desc: 'Медленная повозка: строит форт в выбранном месте.',
  },
  tcWagon: {
    name: 'Фургон городского центра', cls: ['wagon'], hp: 1200, speed: 4.2, los: 16, pop: 0, cost: null, age: 1, armor: { ranged: 0.5 }, radius: 1.2, height: 2.4,
    model: 'wagon', builds: 'tc', desc: 'Повозка поселенцев: основывает новый городской центр.',
  },
  // ---- gaia
  deer: { name: 'Олень', cls: ['animal', 'huntable'], hp: 50, speed: 6, walk: 1.6, los: 12, food: 300, radius: 0.6, height: 1.5, model: 'deer' },
  pronghorn: { name: 'Вилорог', cls: ['animal', 'huntable'], hp: 45, speed: 6.5, walk: 1.6, los: 12, food: 250, radius: 0.55, height: 1.3, model: 'pronghorn' },
  caribou: { name: 'Карибу', cls: ['animal', 'huntable'], hp: 80, speed: 5.5, walk: 1.4, los: 12, food: 400, radius: 0.7, height: 1.7, model: 'caribou' },
  bison: { name: 'Бизон', cls: ['animal', 'huntable'], hp: 160, speed: 5, walk: 1.2, los: 12, food: 500, radius: 0.95, height: 1.9, model: 'bison' },
  wolf: {
    name: 'Волк', cls: ['animal', 'guardian'], hp: 120, speed: 6.5, los: 14, radius: 0.5, height: 0.9, model: 'wolf',
    melee: { dmg: 11, rof: 1.2, range: 1.4, anim: 'bite' }, armor: {},
  },
  bear: {
    name: 'Медведь', cls: ['animal', 'guardian'], hp: 380, speed: 5.5, los: 14, radius: 0.8, height: 1.4, model: 'bear',
    melee: { dmg: 24, rof: 1.6, range: 1.8, anim: 'bite' }, armor: { melee: 0.1 },
  },
  bandit: {
    name: 'Разбойник', cls: ['guardian', 'infantry'], hp: 140, speed: 4.2, los: 14, radius: 0.45, height: 1.85, model: 'bandit',
    ranged: { dmg: 14, range: 10, rof: 3, proj: 'musket', anim: 'gun' }, melee: { dmg: 9, rof: 1.5, range: 1.6, anim: 'pike' }, armor: {},
  },
  tradeWagon: { name: 'Торговый обоз', cls: ['wagon', 'trade'], hp: 1, speed: 5, los: 0, radius: 1.2, height: 2.2, model: 'tradeWagon' },
};
for (const k in UNITS) {
  const u = UNITS[k]; u.key = k;
  u.tags = new Set(u.cls);
  if (!u.armor) u.armor = {};
  if (u.radius === undefined) u.radius = 0.5;
}

// ---------------------------------------------------------------- buildings
const BUILDINGS = {
  tc: {
    name: 'Городской центр', size: 10, hp: 3000, los: 28, pop: 10, cost: { wood: 600, coin: 500 }, time: 120, age: 4, height: 9,
    attack: { dmg: 22, range: 20, rof: 2, proj: 'musket' }, trains: ['settler'], techs: ['tc_fortify'], garrison: 20, wagonOnly: true,
    desc: 'Сердце колонии: обучает поселенцев, переводит в новую эпоху, обстреливает врагов. Поселенцы могут укрыться внутри.',
  },
  house: { name: 'Дом', size: 4, hp: 700, los: 10, pop: 10, cost: { wood: 100 }, time: 25, age: 1, height: 4.5, hotkey: 'Q', desc: '+10 к лимиту населения.' },
  mill: {
    name: 'Мельница', size: 6, hp: 1500, los: 12, cost: { wood: 400 }, time: 50, age: 1, height: 9, hotkey: 'W', gather: 'food', rateKey: 'farm', slots: 10,
    techs: ['seedDrill', 'fertilizer'], desc: 'Неиссякаемый источник еды: до 10 поселенцев работают на полях вокруг.',
  },
  market: {
    name: 'Рынок', size: 8, hp: 2000, los: 12, cost: { wood: 300 }, time: 45, age: 1, height: 5, hotkey: 'E', trade: true,
    techs: ['huntingDogs', 'gangSaw', 'stonecutters', 'placerMines', 'circularSaw', 'deepMining', 'blasting'], desc: 'Улучшения сбора ресурсов и торговля: еду, дерево и камень можно купить или продать за монеты.',
  },
  outpost: {
    name: 'Застава', size: 4, hp: 1200, los: 30, cost: { wood: 200 }, time: 35, age: 1, height: 8, hotkey: 'R',
    attack: { dmg: 12, range: 20, rof: 2, proj: 'musket' }, desc: 'Сторожевая вышка с большим обзором. Обстреливает врагов.',
  },
  plantation: {
    name: 'Плантация', size: 6, hp: 1500, los: 12, cost: { wood: 400 }, time: 55, age: 2, height: 5, hotkey: 'T', gather: 'coin', rateKey: 'plantation', slots: 10,
    techs: ['bookkeeping', 'exchange'], desc: 'Неиссякаемый источник монет: до 10 поселенцев.',
  },
  barracks: {
    name: 'Казармы', size: 8, hp: 2500, los: 14, cost: { wood: 200 }, time: 45, age: 2, height: 6, hotkey: 'A',
    trains: ['musketeer', 'pikeman', 'crossbowman', 'longbowman', 'strelet', 'rodelero', 'skirmisher', 'grenadier'], techs: ['vetInf', 'guardInf', 'impInf'],
    desc: 'Обучение пехоты.',
  },
  stable: {
    name: 'Конюшня', size: 8, hp: 2500, los: 14, cost: { wood: 250 }, time: 50, age: 2, height: 6, hotkey: 'S',
    trains: ['hussar', 'dragoon', 'cuirassier'], techs: ['vetCav', 'guardCav', 'impCav'], desc: 'Обучение кавалерии.',
  },
  church: {
    name: 'Церковь', size: 8, hp: 2200, los: 14, cost: { wood: 200, stone: 150 }, time: 50, age: 2, height: 13, hotkey: 'D',
    techs: ['masonry', 'fieldHospital', 'fervor'], desc: 'Каменный храм: технологии прочности, лечения и боевого духа.',
  },
  foundry: {
    name: 'Литейный двор', size: 8, hp: 2500, los: 14, cost: { wood: 250, stone: 200 }, time: 60, age: 3, height: 9, hotkey: 'F',
    trains: ['falconet', 'mortar', 'culverin'], techs: ['vetArt', 'guardArt', 'impArt'], desc: 'Отливка пушек и мортир.',
  },
  arsenal: {
    name: 'Арсенал', size: 8, hp: 2200, los: 14, cost: { wood: 200, stone: 150 }, time: 50, age: 3, height: 6, hotkey: 'G',
    techs: ['paperCartridge', 'cuirass', 'breastplate', 'gunnersQuadrant'], desc: 'Военные технологии для всех родов войск.',
  },
  tower: {
    name: 'Бастион', size: 6, hp: 3200, los: 26, cost: { wood: 100, stone: 300 }, time: 60, age: 2, height: 9.5, hotkey: 'X',
    attack: { dmg: 46, range: 24, rof: 4.2, proj: 'cannon', splash: 2.3 }, bonus: { artillery: 1.5, cavalry: 1.2 }, techs: ['heavyGuns'],
    desc: 'Каменная башня с пушкой: бьёт ядрами по площади, очень прочная. Строится из камня.',
  },
  tradingPost: {
    name: 'Торговый пост', size: 4, hp: 1200, los: 16, cost: { wood: 200 }, time: 40, age: 1, height: 7, hotkey: 'Z', socket: true,
    desc: 'Строится только на гнезде торгового пути. Каждый проходящий обоз приносит опыт или монеты.',
  },
  fort: {
    name: 'Форт', size: 16, hp: 8000, los: 32, cost: null, time: 90, age: 3, height: 8, wagonOnly: true, pop: 0,
    attack: { dmg: 34, range: 26, rof: 2, shots: 3, proj: 'musket' }, trains: ['musketeer', 'pikeman', 'crossbowman', 'longbowman', 'strelet', 'rodelero', 'skirmisher', 'hussar', 'dragoon', 'cuirassier', 'falconet'],
    desc: 'Мощная крепость: огромный обзор, сильный обстрел, обучает войска.',
  },
};
for (const k in BUILDINGS) { const b = BUILDINGS[k]; b.key = k; b.cells = b.size / CELL; }
const VILLAGER_BUILDS = ['house', 'mill', 'market', 'outpost', 'plantation', 'barracks', 'stable', 'church', 'foundry', 'arsenal', 'tradingPost', 'tower'];

// ---------------------------------------------------------------- technologies
const TECHS = {
  tc_fortify: { name: 'Укреплённый центр', at: 'tc', age: 2, cost: { wood: 200, stone: 300 }, time: 40, fx: { tcHp: 1.5, tcAtk: 1.5 }, desc: 'Городские центры: +50% прочности и атаки.', icon: 'shield' },
  huntingDogs: { name: 'Охотничьи собаки', at: 'market', age: 1, cost: { food: 125, wood: 75 }, time: 25, fx: { gather: { hunt: 0.15, berry: 0.15 } }, desc: 'Охота и сбор ягод +15%.', icon: 'food' },
  gangSaw: { name: 'Двуручная пила', at: 'market', age: 1, cost: { food: 125, wood: 75 }, time: 25, fx: { gather: { wood: 0.2 } }, desc: 'Рубка леса +20%.', icon: 'wood' },
  stonecutters: { name: 'Каменотёсы', at: 'market', age: 1, cost: { food: 100, wood: 125 }, time: 25, fx: { gather: { quarry: 0.2 } }, desc: 'Добыча камня +20%.', icon: 'stone' },
  placerMines: { name: 'Россыпная добыча', at: 'market', age: 2, cost: { food: 200, wood: 150 }, time: 30, fx: { gather: { mine: 0.2 } }, desc: 'Добыча в рудниках +20%.', icon: 'coin' },
  circularSaw: { name: 'Циркулярная пила', at: 'market', age: 3, cost: { food: 400, coin: 300 }, time: 40, fx: { gather: { wood: 0.25 } }, desc: 'Рубка леса +25%.', icon: 'wood' },
  deepMining: { name: 'Глубинная разработка', at: 'market', age: 3, cost: { food: 400, wood: 300 }, time: 40, fx: { gather: { mine: 0.25 } }, desc: 'Добыча в рудниках +25%.', icon: 'coin' },
  blasting: { name: 'Пороховой подрыв', at: 'market', age: 3, cost: { food: 350, coin: 250 }, time: 40, fx: { gather: { quarry: 0.25 } }, desc: 'Добыча камня +25%.', icon: 'stone' },
  heavyGuns: { name: 'Тяжёлые орудия', at: 'tower', age: 3, cost: { wood: 250, coin: 250 }, time: 40, fx: { towerAtk: 1.3 }, desc: 'Бастионы и заставы: +30% урона.', icon: 'cannon' },
  seedDrill: { name: 'Сеялка', at: 'mill', age: 2, cost: { wood: 300, coin: 150 }, time: 35, fx: { gather: { farm: 0.2 } }, desc: 'Работа на мельнице +20%.', icon: 'food' },
  fertilizer: { name: 'Удобрения', at: 'mill', age: 3, cost: { wood: 600, coin: 400 }, time: 45, fx: { gather: { farm: 0.25 } }, desc: 'Работа на мельнице +25%.', icon: 'food' },
  bookkeeping: { name: 'Бухгалтерия', at: 'plantation', age: 2, cost: { food: 300, wood: 150 }, time: 35, fx: { gather: { plantation: 0.2 } }, desc: 'Работа на плантации +20%.', icon: 'coin' },
  exchange: { name: 'Товарная биржа', at: 'plantation', age: 3, cost: { food: 600, wood: 400 }, time: 45, fx: { gather: { plantation: 0.25 } }, desc: 'Работа на плантации +25%.', icon: 'coin' },
  masonry: { name: 'Каменщики', at: 'church', age: 2, cost: { wood: 150, stone: 250 }, time: 35, fx: { bldHp: 1.25 }, desc: 'Все здания: +25% прочности.', icon: 'shield' },
  fieldHospital: { name: 'Полевые лазареты', at: 'church', age: 3, cost: { food: 300, coin: 300 }, time: 40, fx: { regen: 1.2 }, desc: 'Бездействующие войска понемногу восстанавливают здоровье.', icon: 'heart' },
  fervor: { name: 'Боевой дух', at: 'church', age: 3, cost: { food: 400, coin: 300 }, time: 40, fx: { speed: { infantry: 1.08, cavalry: 1.05 } }, desc: 'Пехота +8% скорости, кавалерия +5%.', icon: 'flag' },
  paperCartridge: { name: 'Бумажный патрон', at: 'arsenal', age: 3, cost: { food: 300, coin: 250 }, time: 40, fx: { dmg: { heavyInf: 1.15, lightCav: 1.15 } }, desc: 'Тяжёлая пехота и драгуны: +15% урона.', icon: 'sword' },
  cuirass: { name: 'Кирасы', at: 'arsenal', age: 3, cost: { food: 300, coin: 300 }, time: 40, fx: { hp: { cavalry: 1.15 } }, desc: 'Кавалерия: +15% здоровья.', icon: 'shield' },
  breastplate: { name: 'Нагрудники', at: 'arsenal', age: 3, cost: { wood: 300, coin: 300 }, time: 40, fx: { hp: { infantry: 1.1 } }, desc: 'Пехота: +10% здоровья.', icon: 'shield' },
  gunnersQuadrant: { name: 'Квадрант канонира', at: 'arsenal', age: 3, cost: { wood: 300, coin: 300 }, time: 40, fx: { dmg: { artillery: 1.15 }, range: { artillery: 2 } }, desc: 'Артиллерия: +15% урона и +2 м дальности.', icon: 'cannon' },
  vetInf: { name: 'Ветераны-пехотинцы', at: 'barracks', age: 3, cost: { food: 600, coin: 400 }, time: 45, fx: { hp: { infantry: 1.2 }, dmg: { infantry: 1.2 } }, desc: 'Пехота: +20% здоровья и урона.', icon: 'rank1' },
  guardInf: { name: 'Гвардейская пехота', at: 'barracks', age: 4, req: 'vetInf', cost: { food: 1000, coin: 800 }, time: 55, fx: { hp: { infantry: 1.3 }, dmg: { infantry: 1.3 } }, desc: 'Пехота: +30% здоровья и урона.', icon: 'rank2' },
  impInf: { name: 'Имперская пехота', at: 'barracks', age: 5, req: 'guardInf', cost: { food: 1500, coin: 1500 }, time: 65, fx: { hp: { infantry: 1.5 }, dmg: { infantry: 1.5 } }, desc: 'Пехота: +50% здоровья и урона.', icon: 'rank3' },
  vetCav: { name: 'Ветераны-кавалеристы', at: 'stable', age: 3, cost: { food: 600, coin: 500 }, time: 45, fx: { hp: { cavalry: 1.2 }, dmg: { cavalry: 1.2 } }, desc: 'Кавалерия: +20% здоровья и урона.', icon: 'rank1' },
  guardCav: { name: 'Гвардейская кавалерия', at: 'stable', age: 4, req: 'vetCav', cost: { food: 1000, coin: 900 }, time: 55, fx: { hp: { cavalry: 1.3 }, dmg: { cavalry: 1.3 } }, desc: 'Кавалерия: +30% здоровья и урона.', icon: 'rank2' },
  impCav: { name: 'Имперская кавалерия', at: 'stable', age: 5, req: 'guardCav', cost: { food: 1500, coin: 1600 }, time: 65, fx: { hp: { cavalry: 1.5 }, dmg: { cavalry: 1.5 } }, desc: 'Кавалерия: +50% здоровья и урона.', icon: 'rank3' },
  vetArt: { name: 'Ветераны-артиллеристы', at: 'foundry', age: 3, cost: { wood: 500, coin: 500 }, time: 45, fx: { hp: { artillery: 1.2 }, dmg: { artillery: 1.2 } }, desc: 'Артиллерия: +20% здоровья и урона.', icon: 'rank1' },
  guardArt: { name: 'Гвардейская артиллерия', at: 'foundry', age: 4, req: 'vetArt', cost: { wood: 900, coin: 900 }, time: 55, fx: { hp: { artillery: 1.3 }, dmg: { artillery: 1.3 } }, desc: 'Артиллерия: +30% здоровья и урона.', icon: 'rank2' },
  impArt: { name: 'Имперская артиллерия', at: 'foundry', age: 5, req: 'guardArt', cost: { wood: 1500, coin: 1500 }, time: 65, fx: { hp: { artillery: 1.5 }, dmg: { artillery: 1.5 } }, desc: 'Артиллерия: +50% здоровья и урона.', icon: 'rank3' },
};
for (const k in TECHS) TECHS[k].key = k;

// ---------------------------------------------------------------- ages & politicians
const AGES = [
  null,
  { name: 'Эпоха открытий', num: 'I' },
  { name: 'Колониальная эпоха', num: 'II', cost: { food: 800 }, time: 40 },
  { name: 'Эпоха крепостей', num: 'III', cost: { food: 1200, coin: 1000 }, time: 55 },
  { name: 'Промышленная эпоха', num: 'IV', cost: { food: 2000, coin: 1200, stone: 300 }, time: 70 },
  { name: 'Имперская эпоха', num: 'V', cost: { food: 3000, coin: 3000, stone: 800 }, time: 80 },
];

const POLITICIANS = {
  2: [
    { key: 'quartermaster', name: 'Квартирмейстер', desc: '+400 дерева и +200 камня', give: { res: { wood: 400, stone: 200 } } },
    { key: 'treasurer', name: 'Казначей', desc: '+400 монет', give: { res: { coin: 400 } } },
    { key: 'colonist', name: 'Колонист', desc: '+3 поселенца', give: { units: { settler: 3 } } },
  ],
  3: [
    { key: 'general', name: 'Генерал', desc: '+6 мушкетёров', give: { units: { musketeer: 6 } } },
    { key: 'engineer', name: 'Инженер', desc: '+2 фальконета', give: { units: { falconet: 2 } } },
    { key: 'merchant', name: 'Купец', desc: '+800 монет и +400 еды', give: { res: { coin: 800, food: 400 } } },
  ],
  4: [
    { key: 'marshal', name: 'Фельдмаршал', desc: '+6 гусар', give: { units: { hussar: 6 } } },
    { key: 'banker', name: 'Банкир', desc: '+1500 монет', give: { res: { coin: 1500 } } },
    { key: 'fortifier', name: 'Фортификатор', desc: 'Фургон форта', give: { units: { fortWagon: 1 } } },
  ],
  5: [
    { key: 'emperor', name: 'Император', desc: '+12 мушкетёров и +4 гусара', give: { units: { musketeer: 12, hussar: 4 } } },
    { key: 'chancellor', name: 'Канцлер', desc: '+3000 монет', give: { res: { coin: 3000 } } },
    { key: 'governor', name: 'Генерал-губернатор', desc: '+2000 еды, +2000 дерева, +1000 камня', give: { res: { food: 2000, wood: 2000, stone: 1000 } } },
  ],
};

// ---------------------------------------------------------------- home city cards
const CARDS = {
  food300: { name: 'Обоз с провиантом', age: 1, give: { res: { food: 300 } } },
  wood300: { name: 'Строевой лес', age: 1, give: { res: { wood: 300 } } },
  coin300: { name: 'Кошель монет', age: 1, give: { res: { coin: 300 } } },
  stone300: { name: 'Баржа с камнем', age: 1, give: { res: { stone: 300 } } },
  settlers3: { name: 'Переселенцы', age: 1, give: { units: { settler: 3 } } },
  ecoTheory: { name: 'Экономическая теория', age: 1, give: { fx: { gather: { all: 0.1 } } }, desc: 'Все поселенцы собирают на 10% быстрее.' },
  brit_manor: { civ: 'britain', name: 'Усадьбы', age: 1, give: { fx: { houseCost: 0.75 } }, desc: 'Дома стоят на 25% дешевле.' },
  fr_coureurs: { civ: 'france', name: 'Лесные бегуны', age: 1, give: { units: { settler: 4 } } },
  ru_furs: { civ: 'russia', name: 'Сибирская пушнина', age: 1, give: { res: { coin: 450 } } },
  sp_conquest: { civ: 'spain', name: 'Конкиста', age: 1, give: { res: { food: 250, coin: 200 } } },
  wood600: { name: 'Корабельный лес', age: 2, give: { res: { wood: 600 } } },
  coin600: { name: 'Серебро короны', age: 2, give: { res: { coin: 600 } } },
  food600: { name: 'Зерно метрополии', age: 2, give: { res: { food: 600 } } },
  stone600: { name: 'Королевские каменоломни', age: 2, give: { res: { stone: 600 } } },
  masons: { name: 'Гильдия каменщиков', age: 2, give: { fx: { gather: { quarry: 0.25 } } }, desc: 'Добыча камня +25%.' },
  settlers5: { name: 'Корабль колонистов', age: 2, give: { units: { settler: 5 } } },
  musk5: { name: 'Рота мушкетёров', age: 2, give: { units: { musketeer: 5 } } },
  pike6: { name: 'Отряд пикинёров', age: 2, give: { units: { pikeman: 6 } } },
  xbow6: { name: 'Арбалетчики', age: 2, give: { units: { crossbowman: 6 } }, notCiv: ['britain', 'russia'] },
  huss3: { name: 'Гусары', age: 2, give: { units: { hussar: 3 } } },
  drill: { name: 'Строевая подготовка', age: 2, give: { fx: { hp: { infantry: 1.1 } } }, desc: 'Пехота: +10% здоровья.' },
  brit_longbow: { civ: 'britain', name: 'Длиннолучники', age: 2, give: { units: { longbowman: 7 } } },
  sp_rodelero: { civ: 'spain', name: 'Роделеро', age: 2, give: { units: { rodelero: 7 } } },
  sp_gold: { civ: 'spain', name: 'Испанское золото', age: 2, give: { res: { coin: 800 } } },
  ru_strelets: { civ: 'russia', name: 'Стрельцы', age: 2, give: { units: { strelet: 12 } } },
  coin1000: { name: 'Королевская казна', age: 3, give: { res: { coin: 1000 } } },
  musk8: { name: 'Полк мушкетёров', age: 3, give: { units: { musketeer: 8 } } },
  skirm7: { name: 'Застрельщики', age: 3, give: { units: { skirmisher: 7 } } },
  huss5: { name: 'Эскадрон гусар', age: 3, give: { units: { hussar: 5 } } },
  drag5: { name: 'Драгуны', age: 3, give: { units: { dragoon: 5 } } },
  falc2: { name: 'Полевая батарея', age: 3, give: { units: { falconet: 2 } } },
  fort: { name: 'Фургон форта', age: 3, give: { units: { fortWagon: 1 } }, desc: 'Повозка, которая строит мощный форт' },
  fr_cuir: { civ: 'france', name: 'Кирасиры', age: 3, give: { units: { cuirassier: 4 } } },
  coin2000: { name: 'Колониальный банк', age: 4, give: { res: { coin: 2000 } }, infinite: true },
  army12: { name: 'Армия метрополии', age: 4, give: { units: { musketeer: 12 } }, infinite: true },
  cav8: { name: 'Кавалерийский полк', age: 4, give: { units: { hussar: 8 } }, infinite: true },
  siege: { name: 'Осадный парк', age: 4, give: { units: { mortar: 2, falconet: 2 } }, infinite: true },
  tcWagon: { name: 'Фургон городского центра', age: 4, give: { units: { tcWagon: 1 } }, desc: 'Повозка, которая основывает новый городской центр' },
  imperial: { name: 'Имперская гвардия', age: 5, give: { units: { musketeer: 15, hussar: 6 } }, infinite: true },
};
for (const k in CARDS) {
  const c = CARDS[k]; c.key = k;
  if (!c.desc) {
    const parts = [];
    if (c.give.res) for (const r in c.give.res) parts.push(c.give.res[r] + ' ' + RES_NAME_GEN[r]);
    if (c.give.units) for (const u in c.give.units) {
      const n = c.give.units[u];
      parts.push(n > 1 ? n + ' × ' + UNITS[u].name.toLowerCase() : UNITS[u].name);
    }
    c.desc = parts.join(', ');
  }
}

// ---------------------------------------------------------------- biomes
const BIOMES = {
  newEngland: {
    name: 'Новая Англия', desc: 'Сосновые леса, озёра и олени',
    grassA: 0x6e8f3c, grassB: 0x4f7330, dirt: 0x7c5f3e, floor: 0x3d4a26, sand: 0xc9b487, rock: 0x7b766c, road: 0x8d7756, field: 0x6b5235, snow: null,
    shallow: 0x5c9a92, deep: 0x1d4a5e,
    sky: 0x9fc0de, horizon: 0xd9e3e8, fog: 0xb9cad8, sun: 0xfff0d2, sunI: 2.4, hemiSky: 0xbdd5ff, hemiGround: 0x5b5a3a, hemiI: 0.55,
    trees: { pine: 0.45, oak: 0.35, birch: 0.2 }, forest: 0.12, hunt: ['deer'], water: 'lakes', hills: 1.0, grassDecor: 1, flower: 0xf2e46a,
  },
  plains: {
    name: 'Великие равнины', desc: 'Бескрайние прерии, стада бизонов, река',
    grassA: 0x9da24c, grassB: 0x75873a, dirt: 0x8a6c47, floor: 0x55562e, sand: 0xcab581, rock: 0x8b8377, road: 0x9b8462, field: 0x76603e, snow: null,
    shallow: 0x6a9a86, deep: 0x2d5560,
    sky: 0xa8c8e8, horizon: 0xe8e2cf, fog: 0xd2d4c6, sun: 0xfff2d0, sunI: 2.35, hemiSky: 0xcad8f0, hemiGround: 0x6e6340, hemiI: 0.5,
    trees: { oak: 0.55, cottonwood: 0.45 }, forest: 0.42, hunt: ['bison', 'pronghorn'], water: 'river', hills: 0.6, grassDecor: 1.6, flower: 0xd89b3c,
  },
  sonora: {
    name: 'Сонора', desc: 'Красные скалы, кактусы и редкие оазисы',
    grassA: 0xc08f58, grassB: 0xa2774a, dirt: 0xa66b40, floor: 0x86704a, sand: 0xd6ad78, rock: 0xa45a3e, road: 0xb08a62, field: 0x8b6a45, snow: null,
    shallow: 0x5fa39a, deep: 0x245a63,
    sky: 0xb6cfe4, horizon: 0xf0dcc0, fog: 0xe3cdb0, sun: 0xffe7c0, sunI: 2.45, hemiSky: 0xd8e0ee, hemiGround: 0x8a6a48, hemiI: 0.5,
    trees: { mesquite: 0.55, saguaro: 0.45 }, forest: 0.38, hunt: ['pronghorn'], water: 'oasis', hills: 1.5, mesas: true, highTint: 0.55, grassDecor: 0.6, flower: 0xe8644a,
  },
  yukon: {
    name: 'Юкон', desc: 'Заснеженная тайга, ледяные озёра, карибу',
    grassA: 0xc9d3db, grassB: 0xaebdc9, dirt: 0x7d7b74, floor: 0x9aa8b2, sand: 0xc8ccc8, rock: 0x6d7174, road: 0x9b9a92, field: 0x8f8170, snow: true,
    shallow: 0x7fb2c4, deep: 0x2a5872,
    sky: 0xa9bdd2, horizon: 0xd6dfe6, fog: 0xc7d2dc, sun: 0xfff1e0, sunI: 1.75, hemiSky: 0xc9d8f0, hemiGround: 0x7c8790, hemiI: 0.5,
    trees: { snowpine: 0.7, spruce: 0.3 }, forest: 0.1, hunt: ['caribou'], water: 'lakes', hills: 1.2, grassDecor: 0.3, flower: 0xffffff,
  },
};

const STANCE_NAMES = { aggressive: 'Агрессивная', defensive: 'Оборонительная' };
