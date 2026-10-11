import test from 'node:test';
import assert from 'node:assert/strict';
import { TERRITORIES, BY_ID, CONTINENTS, MAPS, getMap } from '../src/game/maps/index.ts';
import {
  newGame,
  DEFAULT_PLAYER_NAME,
  normalizePlayerName,
  territoriesOf,
  armiesOf,
  reinforcement,
  deploy,
  undeploy,
  beginAttack,
  canAttack,
  resolveDice,
  attack,
  completeConquest,
  connected,
  beginFortify,
  fortifyPreview,
  fortify,
  endTurn,
  validSet,
  findSet,
  trade,
  aiDeploy,
  aiAttackChoice,
  aiCompleteConquest,
  aiFortify,
  computerStep,
  skipComputerTurns,
  validateSave,
} from '../src/game/engine.ts';

function random(seed = 123) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test('42 territories, correct continent sizes, symmetric connections and a connected world', () => {
  assert.equal(TERRITORIES.length, 42);
  assert.equal(new Set(TERRITORIES.map((t) => t.id)).size, 42);
  assert.deepEqual(
    CONTINENTS.map((c) => TERRITORIES.filter((t) => t.continent === c.id).length),
    [9, 4, 7, 6, 12, 4],
  );
  for (const t of TERRITORIES)
    for (const n of t.neighbors) assert(BY_ID[n].neighbors.includes(t.id));
  const seen = new Set(['alaska']),
    queue = ['alaska'];
  for (const id of queue)
    for (const n of BY_ID[id].neighbors)
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  assert.equal(seen.size, 42);
});
test('balanced setup for all opponent counts; every territory has troops', () => {
  for (const opponents of [1, 2, 3]) {
    const g = newGame({ opponents }, random());
    assert(validateSave(g));
    for (const p of g.players) {
      assert.equal(armiesOf(g, p.id), [0, 40, 35, 30][opponents]);
      assert(territoriesOf(g, p.id).length >= Math.floor(42 / (opponents + 1)));
    }
    assert.equal(g.reserve, reinforcement(g, 0));
    assert(!beginAttack(g));
    const own = territoriesOf(g, 0)[0].id,
      foreign = territoriesOf(g, 1)[0].id;
    assert(!deploy(g, foreign));
    assert(!deploy(g, own, -1));
    assert(!deploy(g, own, 1.5));
    assert(deploy(g, own, g.reserve));
    assert(beginAttack(g));
  }
});
test('dice compare descending, defender wins ties', () => {
  assert.deepEqual(resolveDice([1, 6, 5], [5, 5]), {
    attackLoss: 1,
    defendLoss: 1,
    attacker: [6, 5, 1],
    defender: [5, 5],
  });
  assert.equal(resolveDice([6], [6]).attackLoss, 1);
});
test('attacks retain actual roll order for animation, without changing sorted comparisons', () => {
  const g = newGame({}, random());
  g.phase = 'attack';
  g.reserve = 0;
  g.board.alaska = { owner: 0, armies: 5 };
  g.board.alberta = { owner: 1, armies: 3 };
  const rolls = [2, 6, 3, 3, 5];
  let index = 0;
  const result = attack(g, 'alaska', 'alberta', () => (rolls[index++] - 1) / 6);
  assert.deepEqual(result.rolledAttacker, [2, 6, 3]);
  assert.deepEqual(result.rolledDefender, [3, 5]);
  assert.deepEqual(result.attacker, [6, 3, 2]);
  assert.deepEqual(result.defender, [5, 3]);
  assert.equal(result.attackLoss, 1);
  assert.equal(result.defendLoss, 1);
  assert.equal(g.board.alaska.armies, 4);
  assert.equal(g.board.alberta.armies, 2);
  assert.equal(index, 5);
  assert(validateSave(g));
});
test('turn attack activity includes unsuccessful attacks, survives reload and resets for the next turn', () => {
  let g = newGame({}, random());
  g.phase = 'attack';
  g.reserve = 0;
  g.board.alaska = { owner: 0, armies: 2 };
  g.board.alberta = { owner: 1, armies: 8 };
  assert.equal(g.attacked, false);
  assert.equal(attack(g, 'alberta', 'alaska'), null);
  assert.equal(g.attacked, false);
  assert(attack(g, 'alaska', 'alberta', () => 0));
  assert.equal(g.conquered, false);
  assert.equal(g.attacked, true);
  g = JSON.parse(JSON.stringify(g));
  assert(validateSave(g));
  assert.equal(g.attacked, true);
  assert(beginFortify(g));
  assert(endTurn(g));
  assert.equal(g.attacked, false);
  delete g.attacked;
  assert(validateSave(g)); // Existing saves remain compatible.
  g.attacked = 'true';
  assert(!validateSave(g));
});
test('reinforcements can be taken back after reload, without taking existing or card bonus troops', () => {
  let g = newGame({}, random());
  const own = territoriesOf(g, 0)[0].id,
    other = territoriesOf(g, 0)[1].id,
    enemy = territoriesOf(g, 1)[0].id;
  const initial = g.board[own].armies,
    reserve = g.reserve;
  assert(!undeploy(g, own));
  assert(deploy(g, own, 2));
  assert(deploy(g, other));
  g = JSON.parse(JSON.stringify(g));
  assert(validateSave(g));
  assert(!undeploy(g, enemy));
  assert(!undeploy(g, own, 3));
  assert(!undeploy(g, own, 1.5));
  assert(!undeploy(g, own, -1));
  g.board[own].armies += 2; // An owned card's bonus is independent of placed reinforcements.
  assert(undeploy(g, own, 2));
  assert.equal(g.board[own].armies, initial + 2);
  assert.equal(g.reserve, reserve - 1);
  assert(!undeploy(g, own));
  assert(deploy(g, own, g.reserve));
  assert(beginAttack(g));
  assert.deepEqual(g.placements, {});
  assert(!undeploy(g, own));
  g.phase = 'fortify';
  assert(endTurn(g));
  assert.deepEqual(g.placements, {});
  assert(!undeploy(g, own));
  g.placements[own] = 1;
  assert(!validateSave(g));
});
test('conquest enforces movement, preserves troops and transfers eliminated player cards', () => {
  const g = newGame({ opponents: 2 }, random());
  for (const t of TERRITORIES) g.board[t.id] = { owner: 0, armies: 1 };
  g.board.alberta = { owner: 1, armies: 1 };
  g.board.china = { owner: 2, armies: 1 };
  g.board.alaska.armies = 10;
  g.phase = 'attack';
  g.players[1].cards = [g.deck.pop()];
  const sequence = [0.99, 0.99, 0.99, 0];
  let i = 0;
  const before = Object.values(g.board).reduce((s, b) => s + b.armies, 0);
  assert(canAttack(g, 'alaska', 'alberta'));
  const result = attack(g, 'alaska', 'alberta', () => sequence[i++]);
  assert(result.conquered);
  assert.equal(g.board.alberta.armies, 3);
  assert(g.pending);
  assert(!canAttack(g, 'alaska', 'nwt'));
  assert(!g.players[1].alive);
  assert.equal(g.players[0].cards.length, 1);
  assert.equal(g.players[1].cards.length, 0);
  assert(!completeConquest(g, 100));
  assert(completeConquest(g, 2));
  assert.equal(g.board.alaska.armies, 5);
  assert.equal(g.board.alberta.armies, 5);
  assert.equal(
    Object.values(g.board).reduce((s, b) => s + b.armies, 0),
    before - 1,
  );
});
test('a conquest with one troop left skips follow-up movement, including forced card trades', () => {
  for (const forcedTrade of [false, true]) {
    const g = newGame({ opponents: 2 }, random());
    g.phase = 'attack';
    g.reserve = 0;
    g.board.alaska = { owner: 0, armies: 4 };
    g.board.alberta = { owner: 1, armies: 1 };
    if (forcedTrade) g.players[0].cards = g.deck.splice(0, 5);
    let i = 0;
    const result = attack(g, 'alaska', 'alberta', () => (i++ < 3 ? 0.99 : 0));
    assert(result.conquered);
    assert.equal(g.board.alaska.armies, 1);
    assert.equal(g.board.alberta.armies, 3);
    assert.equal(g.pending, null);
    assert.equal(g.phase, forcedTrade ? 'reinforce' : 'attack');
    assert.equal(g.resumeAttack, forcedTrade);
    assert(validateSave(g));
    assert(!completeConquest(g, 0));
  }
});
test('connected fortification allows an owned path, blocks enemy paths and second moves', () => {
  const g = newGame({}, random());
  for (const t of TERRITORIES) g.board[t.id] = { owner: 1, armies: 1 };
  for (const id of ['alaska', 'alberta', 'wus', 'central']) g.board[id].owner = 0;
  g.board.alaska.armies = 7;
  assert(connected(g, 'alaska', 'central'));
  g.board.wus.owner = 1;
  assert(!connected(g, 'alaska', 'central'));
  g.board.wus.owner = 0;
  g.phase = 'attack';
  assert(beginFortify(g));
  assert(!fortify(g, 'alaska', 'central', 7));
  assert(fortify(g, 'alaska', 'central', 6));
  assert.equal(g.board.alaska.armies, 1);
  assert(!fortify(g, 'central', 'alberta', 1));
});
test('continent bonus and escalating card trade with owned-territory bonus', () => {
  const g = newGame({}, random());
  for (const t of TERRITORIES) g.board[t.id].owner = 1;
  for (const t of TERRITORIES.filter((t) => t.continent === 'au')) g.board[t.id].owner = 0;
  assert.equal(reinforcement(g, 0), 5);
  const cards = g.deck.filter((c) => c.type === 0).slice(0, 3);
  g.deck = g.deck.filter((c) => !cards.includes(c));
  g.players[0].cards = cards;
  g.board[cards[0].territory].owner = 0;
  const a = g.board[cards[0].territory].armies,
    r = g.reserve;
  assert(findSet(cards));
  assert(trade(g));
  assert.equal(g.reserve, r + 4);
  assert.equal(g.board[cards[0].territory].armies, a + 2);
  assert.equal(g.tradeCount, 1);
  assert.equal(g.discard.length, 3);
  assert(!validSet([{ type: 0 }, { type: 0 }, { type: 1 }]));
});
test('one card per conquering turn and eliminated players skipped', () => {
  const g = newGame({}, random());
  g.phase = 'fortify';
  g.conquered = true;
  const before = g.deck.length;
  assert(endTurn(g));
  assert.equal(g.players[0].cards.length, 1);
  assert.equal(g.deck.length, before - 1);
  assert.equal(g.turn, 1);
  g.phase = 'fortify';
  g.players[2].alive = false;
  for (const t of territoriesOf(g, 2)) g.board[t.id].owner = 1;
  assert(endTurn(g));
  assert.equal(g.turn, 0);
  assert.equal(g.round, 2);
});
test('taking the final territory ends the game', () => {
  const g = newGame({ opponents: 1 }, random());
  for (const t of TERRITORIES) g.board[t.id] = { owner: 0, armies: 1 };
  g.board.alberta = { owner: 1, armies: 1 };
  g.board.alaska.armies = 5;
  g.phase = 'attack';
  let i = 0;
  attack(g, 'alaska', 'alberta', () => (i++ < 3 ? 0.99 : 0));
  assert.equal(g.winner, 0);
  assert.equal(g.phase, 'finished');
  assert(validateSave(g));
  assert(!endTurn(g));
});
test('inherited cards interrupt attacks, require trades and resume the attack phase', () => {
  const g = newGame({ opponents: 2 }, random());
  for (const t of TERRITORIES) g.board[t.id] = { owner: 0, armies: 1 };
  g.board.alberta = { owner: 1, armies: 1 };
  g.board.china = { owner: 2, armies: 1 };
  g.board.alaska.armies = 10;
  g.phase = 'attack';
  g.reserve = 0;
  g.players[0].cards = g.deck.splice(0, 4);
  g.players[1].cards = g.deck.splice(0, 4);
  let i = 0;
  attack(g, 'alaska', 'alberta', () => (i++ < 3 ? 0.99 : 0));
  assert(completeConquest(g, 0));
  assert.equal(g.phase, 'reinforce');
  assert(g.resumeAttack);
  assert.equal(g.players[0].cards.length, 8);
  assert(!beginAttack(g));
  while (g.players[0].cards.length >= 5) assert(trade(g));
  assert.equal(g.players[0].cards.length, 2);
  assert.equal(g.reserve, 10);
  assert(deploy(g, 'alaska', g.reserve));
  assert(beginAttack(g));
  assert.equal(g.phase, 'attack');
  assert(!g.resumeAttack);
  assert.equal(g.attacked, true);
  assert(validateSave(g));
});
test('saved games reject invalid armies, owners and card duplication', () => {
  const g = newGame({}, random());
  assert(validateSave(JSON.parse(JSON.stringify(g))));
  g.board.alaska.armies = 0;
  assert(!validateSave(g));
  g.board.alaska.armies = 1;
  g.board.alaska.owner = 9;
  assert(!validateSave(g));
  g.board.alaska.owner = 0;
  g.deck[0] = g.deck[1];
  assert(!validateSave(g));
});
test('complete AI matches finish and preserve game invariants at every turn', () => {
  for (const difficulty of ['easy', 'medium', 'hard'])
    for (const opponents of [1, 2, 3]) {
      const rng = random(40 + opponents);
      const g = newGame({ opponents, difficulty }, rng);
      let turns = 0;
      while (g.winner === null && turns++ < 800) {
        aiDeploy(g, rng);
        assert.equal(g.reserve, 0);
        assert.equal(g.phase, 'attack');
        let battles = 0;
        while (g.phase === 'attack' && g.winner === null && battles++ < 65) {
          const choice = aiAttackChoice(g, rng);
          if (!choice) break;
          assert(attack(g, choice.from, choice.to, rng));
          aiCompleteConquest(g);
          if (g.phase === 'reinforce') aiDeploy(g, rng);
        }
        if (g.winner !== null) break;
        assert(beginFortify(g));
        aiFortify(g);
        assert(endTurn(g, rng));
        assert(validateSave(g), `Invalid state: ${difficulty}, ${opponents}, ${turns}`);
      }
      assert.notEqual(g.winner, null, `Match did not finish: ${difficulty}, ${opponents}`);
    }
});

test('fortification previews preserve state and match the committed movement', () => {
  const g = newGame({}, random());
  g.phase = 'fortify';
  g.reserve = 0;
  g.board.alaska = { owner: 0, armies: 12 };
  g.board.nwt = { owner: 0, armies: 2 };
  g.board.ontario = { owner: 0, armies: 2 };
  const before = JSON.stringify(g);
  assert.deepEqual(fortifyPreview(g, 'alaska', 'ontario', 11), { fromArmies: 1, toArmies: 13 });
  assert.deepEqual(fortifyPreview(g, 'alaska', 'ontario', 5), { fromArmies: 7, toArmies: 7 });
  assert.equal(JSON.stringify(g), before);
  assert.equal(fortifyPreview(g, 'alaska', 'ontario', 12), null);
  assert.equal(fortifyPreview(g, 'alaska', 'ontario', 0), null);
  assert.equal(fortifyPreview(g, 'alaska', 'alaska', 1), null);
  assert(fortify(g, 'alaska', 'ontario', 5));
  assert.equal(g.board.alaska.armies, 7);
  assert.equal(g.board.ontario.armies, 7);
  assert.equal(fortifyPreview(g, 'ontario', 'alaska', 1), null);
});
test('a conquered territory can start another attack in the same phase', () => {
  const g = newGame({ opponents: 2 }, random());
  g.phase = 'attack';
  g.reserve = 0;
  g.board.alaska = { owner: 0, armies: 20 };
  g.board.alberta = { owner: 1, armies: 1 };
  g.board.wus = { owner: 1, armies: 1 };
  const winDice = () => {
    let i = 0;
    return () => (i++ < 3 ? 0.99 : 0);
  };
  assert(attack(g, 'alaska', 'alberta', winDice()).conquered);
  assert(!canAttack(g, 'alberta', 'wus'));
  assert(completeConquest(g, g.pending.max));
  assert.equal(g.phase, 'attack');
  assert(canAttack(g, 'alberta', 'wus'));
  assert(attack(g, 'alberta', 'wus', winDice()).conquered);
  assert(completeConquest(g, 0));
  assert.equal(g.phase, 'attack');
  assert.equal(g.stats.conquests, 2);
});

test('player names have a neutral default, normalize input and survive saving', () => {
  assert.equal(newGame({}, random()).players[0].name, DEFAULT_PLAYER_NAME);
  assert.equal(normalizePlayerName('  Stern   Eins  '), 'Stern Eins');
  assert.equal(normalizePlayerName('   '), DEFAULT_PLAYER_NAME);
  assert.equal(normalizePlayerName(null), DEFAULT_PLAYER_NAME);
  assert.equal(normalizePlayerName('a'.repeat(40)).length, 20);
  const g = newGame({ playerName: '  Vega Prime  ' }, random());
  assert.equal(g.players[0].name, 'Vega Prime');
  assert.equal(g.players[1].name, 'Atlas');
  const saved = JSON.parse(JSON.stringify(g));
  assert(validateSave(saved));
  assert.equal(saved.players[0].name, 'Vega Prime');
});

test('Europe has 28 unique territories, valid symmetric sea routes and connected bonus regions', () => {
  const map = MAPS.europe;
  assert.equal(map.territories.length, 28);
  assert.equal(new Set(map.territories.map((t) => t.id)).size, 28);
  for (const t of map.territories) {
    assert(map.continents.some((c) => c.id === t.continent));
    assert(t.neighbors.length);
    assert.equal(new Set(t.neighbors).size, t.neighbors.length);
    for (const id of t.neighbors) assert(map.byId[id].neighbors.includes(t.id));
  }
  const reachable = (allowed) => {
    const seen = new Set([allowed[0].id]),
      queue = [allowed[0].id];
    for (const id of queue)
      for (const next of map.byId[id].neighbors)
        if (!seen.has(next) && allowed.some((t) => t.id === next)) {
          seen.add(next);
          queue.push(next);
        }
    return seen.size;
  };
  assert.equal(reachable(map.territories), 28);
  for (const c of map.continents) {
    const ts = map.territories.filter((t) => t.continent === c.id);
    assert(ts.length);
    assert.equal(reachable(ts), ts.length);
    assert(map.bonuses[c.id]);
  }
  for (const [a, b] of map.seaLinks) assert(map.byId[a].neighbors.includes(b));
});
test('Europe setup and saves preserve map choice; legacy world saves remain valid', () => {
  for (const opponents of [1, 2, 3]) {
    const g = newGame({ mapId: 'europe', opponents }, random());
    assert.equal(getMap(g).id, 'europe');
    assert.equal(g.deck.length, 28);
    assert(validateSave(g));
    const counts = g.players.map((p) => territoriesOf(g, p.id).length);
    assert(Math.max(...counts) - Math.min(...counts) <= 1);
    for (const p of g.players)
      assert.equal(armiesOf(g, p.id), MAPS.europe.startingArmies[opponents - 1]);
    const saved = JSON.parse(JSON.stringify(g));
    assert(validateSave(saved));
    assert.equal(saved.settings.mapId, 'europe');
    saved.settings.mapId = 'world';
    assert(!validateSave(saved));
    saved.settings.mapId = 'unknown';
    assert(!validateSave(saved));
  }
  const world = newGame({}, random());
  delete world.settings.mapId;
  assert(validateSave(world));
  assert.equal(getMap(world).id, 'world');
});
test('Europe bonuses, sea attacks, cards and the 28-territory victory use their own map', () => {
  const g = newGame({ mapId: 'europe', opponents: 1 }, random());
  for (const t of MAPS.europe.territories) g.board[t.id] = { owner: 1, armies: 1 };
  for (const t of MAPS.europe.territories.filter((t) => t.continent === 'atlantic'))
    g.board[t.id].owner = 0;
  assert.equal(reinforcement(g, 0), 5);
  g.phase = 'attack';
  g.board.britain.armies = 10;
  assert(canAttack(g, 'britain', 'france'));
  assert(!canAttack(g, 'britain', 'turkey'));
  assert(!canAttack(g, 'alaska', 'alberta'));
  g.phase = 'reinforce';
  const set = findSet(g.deck);
  g.players[0].cards = set.map((i) => g.deck[i]);
  g.deck = g.deck.filter((c, i) => !set.includes(i));
  assert(trade(g));
  assert(validateSave(g));
  for (const t of MAPS.europe.territories) g.board[t.id] = { owner: 0, armies: 1 };
  g.board.portugal = { owner: 1, armies: 1 };
  g.board.spain.armies = 8;
  g.phase = 'attack';
  g.placements = {};
  let i = 0;
  assert(attack(g, 'spain', 'portugal', () => (i++ < 3 ? 0.99 : 0)).conquered);
  assert.equal(g.winner, 0);
  assert.equal(g.phase, 'finished');
  assert(validateSave(g));
  const world = newGame({}, random());
  assert.equal(world.deck.length, 42);
  assert(validateSave(world));
});
test('complete Europe AI matches finish on every difficulty and opponent count', () => {
  for (const difficulty of ['easy', 'medium', 'hard'])
    for (const opponents of [1, 2, 3]) {
      const rng = random(70 + opponents),
        g = newGame({ mapId: 'europe', opponents, difficulty }, rng);
      let turns = 0;
      while (g.winner === null && turns++ < 800) {
        aiDeploy(g, rng);
        assert.equal(g.reserve, 0);
        assert.equal(g.phase, 'attack');
        let battles = 0;
        while (g.phase === 'attack' && g.winner === null && battles++ < 65) {
          const choice = aiAttackChoice(g, rng);
          if (!choice) break;
          assert(attack(g, choice.from, choice.to, rng));
          aiCompleteConquest(g);
          if (g.phase === 'reinforce') aiDeploy(g, rng);
        }
        if (g.winner !== null) break;
        assert(beginFortify(g));
        aiFortify(g);
        assert(endTurn(g, rng));
        assert(validateSave(g), `${difficulty}, ${opponents}, turn ${turns}`);
      }
      assert.notEqual(g.winner, null, `Europe match did not finish: ${difficulty}, ${opponents}`);
      assert(validateSave(g));
      assert.equal(territoriesOf(g, g.winner).length, 28);
    }
});

test('skipping computer turns preserves the results of animated turns and the tempo setting', () => {
  for (const mapId of ['world', 'europe'])
    for (const opponents of [1, 2, 3])
      for (const difficulty of ['easy', 'medium', 'hard']) {
        const initial = newGame({ mapId, opponents, difficulty, fast: true }, random(111));
        const id = territoriesOf(initial, 0)[0].id;
        deploy(initial, id, initial.reserve);
        beginAttack(initial);
        beginFortify(initial);
        endTurn(initial, random(112));
        const animated = JSON.parse(JSON.stringify(initial)),
          skipped = JSON.parse(JSON.stringify(initial));
        const normalProgress = { turn: -1, combats: 0 },
          skipProgress = { turn: -1, combats: 0 },
          normalRng = random(333),
          skipRng = random(333);
        let count = 0;
        while (animated.turn !== 0 && animated.winner === null) {
          const result = computerStep(animated, normalProgress, normalRng);
          count++;
          if (result.humanEliminated) break;
        }
        const result = skipComputerTurns(skipped, skipProgress, skipRng);
        assert.deepEqual(skipped, animated, `${mapId}, ${opponents}, ${difficulty}`);
        assert.equal(result.steps, count);
        assert(skipped.settings.fast);
        assert(validateSave(skipped));
        assert(skipped.turn === 0 || skipped.winner !== null || !skipped.players[0].alive);
      }
});
test('skipping stops at victory and keeps eliminated player cards valid', () => {
  const g = newGame({ opponents: 3 }, random());
  for (const t of TERRITORIES) g.board[t.id] = { owner: 1, armies: 1 };
  g.board.alaska = { owner: 0, armies: 1 };
  g.board.kamchatka.armies = 100;
  g.players[2].alive = false;
  g.players[3].alive = false;
  g.players[0].cards = [g.deck.pop()];
  g.turn = 1;
  g.phase = 'attack';
  g.reserve = 0;
  g.placements = {};
  const result = skipComputerTurns(g, { turn: -1, combats: 0 }, random(7));
  assert(result.humanEliminated);
  assert.equal(g.winner, 1);
  assert.equal(g.phase, 'finished');
  assert.equal(g.players[0].cards.length, 0);
  assert.equal(g.players[1].cards.length, 1);
  assert(validateSave(g));
});
test('spectators skip one computer round, without changing normal-speed settings', () => {
  const g = newGame({ opponents: 3, mapId: 'europe' }, random());
  for (const t of territoriesOf(g, 0)) g.board[t.id].owner = 1;
  g.players[0].alive = false;
  g.turn = 1;
  g.reserve = reinforcement(g, 1);
  g.placements = {};
  const round = g.round;
  const result = skipComputerTurns(g, { turn: -1, combats: 0 }, random(55));
  assert(result.steps > 0);
  assert(g.round > round || g.winner !== null);
  assert(!g.settings.fast);
  assert(validateSave(g));
});
