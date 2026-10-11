import type { GameState, Random, Territory, AttackChoice } from './types';
import { getMap } from './maps';
import {
  territoriesOf,
  findSet,
  trade,
  deploy,
  beginAttack,
  canAttack,
  completeConquest,
  connected,
  fortify,
} from './engine';
export function borderScore(g: GameState, t: Territory) {
  const enemies = t.neighbors.filter((id) => g.board[id].owner !== g.turn);
  return enemies.length
    ? enemies.reduce((s, id) => s + g.board[id].armies, 0) / Math.max(1, g.board[t.id].armies) +
        enemies.length * 0.4
    : 0;
}
export function aiDeploy(g: GameState, rng: Random = Math.random) {
  while (g.players[g.turn].cards.length >= 5 || (g.reserve > 0 && findSet(g.players[g.turn].cards)))
    if (!trade(g)) break;
  const ts = territoriesOf(g, g.turn);
  const borders = ts.filter((t) => t.neighbors.some((id) => g.board[id].owner !== g.turn));
  if (!borders.length) return;
  const target = [...borders].sort((a, b) => aiValue(g, b) - aiValue(g, a))[0];
  if (g.settings.difficulty === 'easy') {
    while (g.reserve) deploy(g, borders[Math.floor(rng() * borders.length)].id);
  } else {
    const reserve = g.reserve;
    deploy(g, target.id, Math.max(1, Math.ceil(reserve * 0.7)));
    while (g.reserve) {
      const weakest = [...borders].sort((a, b) => borderScore(g, b) - borderScore(g, a))[0];
      deploy(g, weakest.id);
    }
  }
  beginAttack(g);
}
function aiValue(g: GameState, t: Territory) {
  const c = getMap(g).territories.filter((x) => x.continent === t.continent),
    have = c.filter((x) => g.board[x.id].owner === g.turn).length;
  const weak = Math.min(
    ...t.neighbors.filter((id) => g.board[id].owner !== g.turn).map((id) => g.board[id].armies),
  );
  return (
    g.board[t.id].armies -
    weak +
    (have / c.length) * (g.settings.difficulty === 'hard' ? 9 : 3) +
    borderScore(g, t) * 0.2
  );
}
export function aiAttackChoice(g: GameState, rng: Random = Math.random): AttackChoice | null {
  const options: AttackChoice[] = [];
  const mode = g.settings.difficulty;
  for (const t of territoriesOf(g, g.turn))
    for (const id of t.neighbors)
      if (canAttack(g, t.id, id)) {
        const own = g.board[t.id].armies - 1,
          enemy = g.board[id].armies;
        const ratio = mode === 'easy' ? 1.55 : mode === 'hard' ? 1.05 : 1.25;
        if (own < enemy * ratio || (own < 3 && enemy > 1)) continue;
        const c = getMap(g).territories.filter((x) => x.continent === getMap(g).byId[id].continent),
          owned = c.filter((x) => g.board[x.id].owner === g.turn).length;
        const score =
          own -
          enemy * 1.2 +
          (mode === 'hard' ? (owned / c.length) * 8 : 0) +
          (mode === 'easy' ? rng() * 8 : 0);
        options.push({ from: t.id, to: id, score });
      }
  return options.sort((a, b) => b.score - a.score)[0] ?? null;
}
export function aiCompleteConquest(g: GameState) {
  if (!g.pending) return;
  const { from, to, max } = g.pending;
  const dangerous = getMap(g).byId[from].neighbors.filter((id) => g.board[id].owner !== g.turn);
  const ahead = getMap(g).byId[to].neighbors.some((id) => g.board[id].owner !== g.turn);
  completeConquest(
    g,
    ahead
      ? Math.max(
          0,
          max - (dangerous.length && g.settings.difficulty === 'hard' ? Math.min(2, max) : 0),
        )
      : Math.floor(max / 2),
  );
}
export function aiFortify(g: GameState) {
  const ts = territoriesOf(g, g.turn);
  const borders = ts.filter((t) => t.neighbors.some((id) => g.board[id].owner !== g.turn));
  const interior = ts
    .filter(
      (t) => g.board[t.id].armies > 1 && !t.neighbors.some((id) => g.board[id].owner !== g.turn),
    )
    .sort((a, b) => g.board[b.id].armies - g.board[a.id].armies);
  for (const from of interior) {
    const target = [...borders]
      .filter((t) => connected(g, from.id, t.id))
      .sort((a, b) => borderScore(g, b) - borderScore(g, a))[0];
    if (target) {
      fortify(g, from.id, target.id, g.board[from.id].armies - 1);
      break;
    }
  }
}
