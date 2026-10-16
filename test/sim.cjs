// Headless-партия ботов без графики. node test/sim.cjs [минуты] [игроков] [сложность] [размер] [биом] [seed]
// headless simulation of the game logic (no rendering)
const fs = require('fs'), path = require('path'), vm = require('vm');
global.THREE = require('three');
const dir = path.join(__dirname, '../src');
const files = ['01_util.js', '02_data.js', '04_mapgen.js', '05_nav.js', '06_gfx_common.js', '10_entities.js', '11_game.js', '12_ai.js'];
let src = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
src += '\n;globalThis.__api = { Game, BotAI, UNITS, BUILDINGS, AGES, CIVS, DIFFICULTY, MAP_SIZES, BIOMES, dist };';
vm.runInThisContext(src, { filename: 'bundle.js' });
const { Game, BotAI } = globalThis.__api;
const minutes = +(process.argv[2] || 20);
const nP = +(process.argv[3] || 2);
const diff = process.argv[4] || 'hard';
const size = process.argv[5] || 'large';
const biome = process.argv[6] || 'newEngland';
const seed = +(process.argv[7] || 12345);
const civs = ['britain', 'france', 'spain', 'russia'];
const players = [];
for (let i = 0; i < nP; i++) players.push({ name: 'P' + i, civ: civs[i % 4], color: 0x2255ff + i * 1000, team: i + 1, difficulty: diff });
const t0 = Date.now();
const game = new Game({ mapSize: size, biome, seed, players });
console.log('init ms', Date.now() - t0, 'trees', game.trees.length, 'units', game.units.length, 'res', game.resources.length, 'sockets', game.sockets.length, 'treasures', game.treasures.length);
for (const p of game.players) game.ais.push(new BotAI(game, p));
game.on('ageUp', (p, to) => console.log(`[${(game.time / 60).toFixed(1)}m] ${p.name} -> age ${to}`));
game.on('defeated', (p) => console.log(`[${(game.time / 60).toFixed(1)}m] ${p.name} defeated`));
game.on('gameOver', (t) => console.log(`[${(game.time / 60).toFixed(1)}m] GAME OVER winner team ${t}`));
let tickMs = 0, maxTick = 0;
const total = minutes * 60 / 0.05;
for (let i = 0; i < total && !game.over; i++) {
  const a = process.hrtime.bigint();
  game.tick();
  const ms = Number(process.hrtime.bigint() - a) / 1e6;
  tickMs += ms; if (ms > maxTick) maxTick = ms;
  if (i % 1200 === 0 && i > 0) {
    const lines = game.players.map((p) => {
      const u = game.units.filter((x) => x.alive && x.owner === p.index);
      const v = u.filter((x) => x.def.tags.has('villager')).length;
      const idle = u.filter((x) => x.def.tags.has('villager') && !x.order).length;
      const mil = u.filter((x) => x.isMilitary && !x.def.hero).length;
      const b = game.buildings.filter((x) => x.alive && x.owner === p.index);
      const bk = {}; b.forEach((x) => bk[x.key] = (bk[x.key] || 0) + 1);
      const act = {};
      for (const x of u) { if (!x.def.tags.has('villager')) continue; let k = x.garrisoned ? 'gar' : !x.order ? 'idle' : x.order.type === 'gather' ? (x.order.target.kind === 'building' ? x.order.target.key : x.order.target.kind === 'unit' ? 'huntL' : x.order.target.rkind) : x.order.type; act[k] = (act[k] || 0) + 1; }
      return `${p.name}(${p.civKey}) ${JSON.stringify(act)} age${p.age}${p.aging ? '*' : ''} vil${v}(idle${idle}) mil${mil} pop${p.popUsed()}/${p.popCap()} F${p.res.food | 0} W${p.res.wood | 0} C${p.res.coin | 0} S${p.res.stone | 0} xp${p.xpTotal | 0} ship${p.shipCount} K${p.stats.killed} L${p.stats.lost} ${JSON.stringify(bk)}`;
    });
    console.log(`--- ${(game.time / 60).toFixed(0)}m  avg tick ${(tickMs / i).toFixed(2)}ms max ${maxTick.toFixed(1)}ms units ${game.units.length}`);
    lines.forEach((l) => console.log('  ' + l));
  }
}
console.log('done', (game.time / 60).toFixed(1), 'min; real', ((Date.now() - t0) / 1000).toFixed(1), 's; avg tick', (tickMs / (game.time / 0.05)).toFixed(2), 'ms');
