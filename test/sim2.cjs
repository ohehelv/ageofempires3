// Партия двух ботов разной сложности (баланс). node test/sim2.cjs [слож1] [слож2] [минуты] [seed]
const fs = require('fs'), path = require('path'), vm = require('vm');
global.THREE = require('three');
const dir = path.join(__dirname, '../src');
const files = ['01_util.js', '02_data.js', '04_mapgen.js', '05_nav.js', '06_gfx_common.js', '10_entities.js', '11_game.js', '12_ai.js'];
let src = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
src += '\n;globalThis.__api = { Game, BotAI };';
vm.runInThisContext(src, { filename: 'bundle.js' });
const { Game, BotAI } = globalThis.__api;
const [d0, d1, minutes, seed] = [process.argv[2] || 'easy', process.argv[3] || 'normal', +(process.argv[4] || 25), +(process.argv[5] || 1)];
const game = new Game({ mapSize: 'large', biome: 'newEngland', seed, players: [
  { name: 'A', civ: 'britain', color: 1, team: 1, difficulty: d0 }, { name: 'B', civ: 'france', color: 2, team: 2, difficulty: d1 }] });
for (const p of game.players) game.ais.push(new BotAI(game, p));
const firstHit = {};
game.on('attacked', (owner, x, z) => { if (firstHit[owner] === undefined) firstHit[owner] = game.time; });
game.on('ageUp', (p, to) => console.log(`[${(game.time / 60).toFixed(1)}m] ${p.name}(${p.difficulty}) -> age ${to}`));
game.on('defeated', (p) => console.log(`[${(game.time / 60).toFixed(1)}m] ${p.name} defeated`));
let waveLog = {};
for (let i = 0; i < minutes * 1200 && !game.over; i++) {
  game.tick();
  for (const ai of game.ais) if (ai.attacking && !waveLog[ai.p.name + ai.waveN]) { waveLog[ai.p.name + ai.waveN] = 1; console.log(`[${(game.time / 60).toFixed(1)}m] ${ai.p.name}(${ai.p.difficulty}) launches wave ${ai.waveN + 1}: ${ai.attacking.size} units`); }
}
console.log('first attacked:', JSON.stringify(Object.fromEntries(Object.entries(firstHit).map(([k, v]) => [k, (v / 60).toFixed(1) + 'm']))), 'over', game.over, 'winner', game.winnerTeam, 'time', (game.time / 60).toFixed(1));
for (const p of game.players) console.log(p.name, p.difficulty, 'age', p.age, 'killed', p.stats.killed, 'lost', p.stats.lost, 'vills', game.units.filter((u) => u.alive && u.owner === p.index && u.def.tags.has('villager')).length);
