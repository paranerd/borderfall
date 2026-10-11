import { aiDeploy, aiAttackChoice, aiCompleteConquest, aiFortify } from './ai';
import type {
  GameState,
  GameOptions,
  Random,
  Territory,
  Card,
  PlayerStyle,
  LogType,
  BattleResult,
  AttackChoice,
  BotProgress,
} from './types';
import { getMap, MAPS } from './maps';

export const DEFAULT_PLAYER_NAME = 'Vega';
export function normalizePlayerName(value: unknown) {
  return (
    Array.from(
      (typeof value === 'string' ? value : '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .replace(/\s+/g, ' '),
    )
      .slice(0, 20)
      .join('') || DEFAULT_PLAYER_NAME
  );
}
export const PLAYER_STYLES: PlayerStyle[] = [
  { name: DEFAULT_PLAYER_NAME, color: '#45b8a2', light: '#b3ded0', symbol: '◈' },
  { name: 'Atlas', color: '#e58b65', light: '#edc5ac', symbol: '▲' },
  { name: 'Nova', color: '#9987d1', light: '#cec4e3', symbol: '◆' },
  { name: 'Orion', color: '#d7b75c', light: '#e5d7a9', symbol: '●' },
];
export const CARD_NAMES = ['Infanterie', 'Kavallerie', 'Artillerie'];
export const SAVE_KEY = 'weltmacht.game.v1';
const shuffle = <T>(arr: T[], rng: Random): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function territoriesOf(g: GameState, p: number) {
  return getMap(g).territories.filter((t) => g.board[t.id].owner === p);
}
export function armiesOf(g: GameState, p: number) {
  return territoriesOf(g, p).reduce((sum, t) => sum + g.board[t.id].armies, 0);
}
export function ownedContinents(g: GameState, p: number) {
  return getMap(g).continents.filter((c) =>
    getMap(g)
      .territories.filter((t) => t.continent === c.id)
      .every((t) => g.board[t.id].owner === p),
  );
}
export function reinforcement(g: GameState, p: number) {
  return (
    Math.max(3, Math.floor(territoriesOf(g, p).length / 3)) +
    ownedContinents(g, p).reduce((s, c) => s + c.bonus, 0)
  );
}
export function log(g: GameState, text: string, type: LogType = 'info') {
  g.log.unshift({ text, type, round: g.round });
  g.log = g.log.slice(0, 35);
}
export function newGame(
  {
    opponents = 2,
    difficulty = 'medium',
    fast = false,
    playerName = DEFAULT_PLAYER_NAME,
    mapId = 'world',
  }: GameOptions = {},
  rng: Random = Math.random,
): GameState {
  playerName = normalizePlayerName(playerName);
  const map = getMap(mapId);
  const n = opponents + 1;
  const g: GameState = {
    version: 1,
    players: PLAYER_STYLES.slice(0, n).map((p, i) => ({
      ...p,
      name: i === 0 ? playerName : p.name,
      id: i,
      cards: [],
      alive: true,
    })),
    board: {},
    turn: 0,
    round: 1,
    phase: 'reinforce',
    reserve: 0,
    conquered: false,
    fortified: false,
    tradeCount: 0,
    deck: shuffle(
      map.territories.map((t) => ({ territory: t.id, type: t.card })),
      rng,
    ),
    discard: [],
    log: [],
    winner: null,
    settings: { difficulty, fast, playerName, mapId: map.id },
    stats: { attacks: 0, conquests: 0 },
    resumeAttack: false,
    pending: null,
  };
  const distribution = shuffle(map.territories, rng);
  distribution.forEach((t, i) => {
    g.board[t.id] = { owner: i % n, armies: 1 };
  });
  for (let p = 0; p < n; p++) {
    const ts = territoriesOf(g, p);
    const total = map.startingArmies[n - 2];
    for (let j = ts.length; j < total; j++) g.board[ts[Math.floor(rng() * ts.length)].id].armies++;
  }
  startTurn(g);
  log(g, 'Die Gebiete sind verteilt. Deine erste Verstärkung wartet.');
  return g;
}
export function startTurn(g: GameState) {
  g.phase = 'reinforce';
  g.reserve = reinforcement(g, g.turn);
  g.placements = {};
  g.attacked = false;
  g.conquered = false;
  g.fortified = false;
  g.resumeAttack = false;
  g.pending = null;
}
export function deploy(g: GameState, id: string, count = 1) {
  if (
    g.winner !== null ||
    g.phase !== 'reinforce' ||
    g.board[id]?.owner !== g.turn ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > g.reserve
  )
    return false;
  g.placements ??= {};
  g.placements[id] = (g.placements[id] ?? 0) + count;
  g.board[id].armies += count;
  g.reserve -= count;
  return true;
}
export function undeploy(g: GameState, id: string, count = 1) {
  if (
    g.winner !== null ||
    g.phase !== 'reinforce' ||
    g.board[id]?.owner !== g.turn ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > (g.placements?.[id] ?? 0) ||
    count >= g.board[id].armies
  )
    return false;
  g.placements![id] -= count;
  g.board[id].armies -= count;
  g.reserve += count;
  return true;
}
export function beginAttack(g: GameState) {
  if (
    g.winner !== null ||
    g.phase !== 'reinforce' ||
    g.reserve ||
    g.players[g.turn].cards.length >= 5
  )
    return false;
  g.phase = 'attack';
  g.placements = {};
  g.resumeAttack = false;
  return true;
}
export function canAttack(g: GameState, from: string | null, to: string | null) {
  return (
    !!from &&
    !!to &&
    g.winner === null &&
    g.phase === 'attack' &&
    !g.pending &&
    getMap(g).byId[from]?.neighbors.includes(to) &&
    g.board[from].owner === g.turn &&
    g.board[to].owner !== g.turn &&
    g.board[from].armies > 1
  );
}
export function resolveDice(attacker: number[], defender: number[]) {
  const a = [...attacker].sort((a, b) => b - a),
    d = [...defender].sort((a, b) => b - a);
  let attackLoss = 0,
    defendLoss = 0;
  for (let i = 0; i < Math.min(a.length, d.length); i++)
    if (a[i] > d[i]) defendLoss++;
    else attackLoss++;
  return { attackLoss, defendLoss, attacker: a, defender: d };
}
export function attack(
  g: GameState,
  from: string,
  to: string,
  rng: Random = Math.random,
): BattleResult | null {
  if (!canAttack(g, from, to)) return null;
  const a = g.board[from],
    d = g.board[to];
  const oldOwner = d.owner;
  const dice = Math.min(3, a.armies - 1),
    defDice = Math.min(2, d.armies);
  const roll = () => Math.floor(rng() * 6) + 1;
  const rolledAttacker = Array.from({ length: dice }, roll),
    rolledDefender = Array.from({ length: defDice }, roll);
  const result: BattleResult = {
    ...resolveDice(rolledAttacker, rolledDefender),
    rolledAttacker,
    rolledDefender,
  };
  a.armies -= result.attackLoss;
  d.armies -= result.defendLoss;
  g.attacked = true;
  g.stats.attacks++;
  if (!d.armies) {
    d.owner = g.turn;
    d.armies = dice;
    a.armies -= dice;
    g.conquered = true;
    g.stats.conquests++;
    g.pending = { from, to, max: a.armies - 1 };
    result.conquered = true;
    log(
      g,
      `${g.turn === 0 ? 'Du eroberst' : g.players[g.turn].name + ' erobert'} ${getMap(g).byId[to].name}.`,
      'conquest',
    );
    if (!territoriesOf(g, oldOwner).length) {
      g.players[oldOwner].alive = false;
      g.players[g.turn].cards.push(...g.players[oldOwner].cards);
      g.players[oldOwner].cards = [];
      log(
        g,
        `${oldOwner === 0 ? 'Du wurdest' : g.players[oldOwner].name + ' wurde'} besiegt.`,
        'elimination',
      );
    }
    if (territoriesOf(g, g.turn).length === getMap(g).territories.length) {
      g.winner = g.turn;
      g.phase = 'finished';
      g.pending = null;
      log(
        g,
        `${g.turn === 0 ? 'Du kontrollierst' : g.players[g.turn].name + ' kontrolliert'} die ganze Karte.`,
        'victory',
      );
    }
    if (g.pending?.max === 0) completeConquest(g, 0);
  }
  return result;
}
export function completeConquest(g: GameState, extra = 0) {
  if (!g.pending || !Number.isInteger(extra) || extra < 0 || extra > g.pending.max) return false;
  const { from, to } = g.pending;
  g.board[from].armies -= extra;
  g.board[to].armies += extra;
  g.pending = null;
  if (g.players[g.turn].cards.length >= 5) {
    g.phase = 'reinforce';
    g.placements = {};
    g.resumeAttack = true;
  }
  return true;
}
export function connected(g: GameState, from: string, to: string, p = g.turn) {
  if (
    !g.board[from] ||
    !g.board[to] ||
    from === to ||
    g.board[from].owner !== p ||
    g.board[to].owner !== p
  )
    return false;
  const queue = [from],
    seen = new Set(queue);
  for (const id of queue)
    for (const next of getMap(g).byId[id].neighbors) {
      if (seen.has(next) || g.board[next].owner !== p) continue;
      if (next === to) return true;
      seen.add(next);
      queue.push(next);
    }
  return false;
}
export function beginFortify(g: GameState) {
  if (g.phase !== 'attack' || g.pending || g.winner !== null) return false;
  g.phase = 'fortify';
  return true;
}
export function fortifyPreview(g: GameState, from: string, to: string, count: number) {
  if (
    g.phase !== 'fortify' ||
    g.fortified ||
    g.winner !== null ||
    !Number.isInteger(count) ||
    count < 1 ||
    count >= g.board[from]?.armies ||
    !connected(g, from, to)
  )
    return null;
  return { fromArmies: g.board[from].armies - count, toArmies: g.board[to].armies + count };
}
export function fortify(g: GameState, from: string, to: string, count: number) {
  const preview = fortifyPreview(g, from, to, count);
  if (!preview) return false;
  g.board[from].armies = preview.fromArmies;
  g.board[to].armies = preview.toArmies;
  g.fortified = true;
  log(
    g,
    `${count} Truppen von ${getMap(g).byId[from].name} nach ${getMap(g).byId[to].name} verlegt.`,
  );
  return true;
}
export function validSet(cards: Card[]) {
  return (
    cards.length === 3 &&
    (cards.every((c) => c.type === cards[0].type) || new Set(cards.map((c) => c.type)).size === 3)
  );
}
export function findSet(cards: Card[]) {
  for (let a = 0; a < cards.length; a++)
    for (let b = a + 1; b < cards.length; b++)
      for (let c = b + 1; c < cards.length; c++)
        if (validSet([cards[a], cards[b], cards[c]])) return [a, b, c];
  return null;
}
export function nextTradeValue(g: GameState) {
  return [4, 6, 8, 10, 12, 15][g.tradeCount] ?? 15 + (g.tradeCount - 5) * 5;
}
export function trade(g: GameState, indices: number[] | null = findSet(g.players[g.turn].cards)) {
  const cards = g.players[g.turn].cards;
  if (
    g.phase !== 'reinforce' ||
    !indices ||
    new Set(indices).size !== 3 ||
    !indices.every((i) => Number.isInteger(i) && i >= 0 && i < cards.length) ||
    !validSet(indices.map((i) => cards[i]))
  )
    return false;
  const set = indices.map((i) => cards[i]);
  const amount = nextTradeValue(g);
  g.tradeCount++;
  g.reserve += amount;
  const owned = set.find((c) => g.board[c.territory].owner === g.turn);
  if (owned) g.board[owned.territory].armies += 2;
  g.discard.push(...set);
  g.players[g.turn].cards = cards.filter((_, i) => !indices.includes(i));
  log(
    g,
    `${g.turn === 0 ? 'Du tauschst' : g.players[g.turn].name + ' tauscht'} Karten gegen ${amount} Truppen${owned ? ' (+2 im passenden Gebiet)' : ''}.`,
  );
  return true;
}
export function endTurn(g: GameState, rng: Random = Math.random) {
  if (g.phase !== 'fortify' || g.winner !== null) return false;
  if (g.conquered) {
    if (!g.deck.length) {
      g.deck = shuffle(g.discard, rng);
      g.discard = [];
    }
    if (g.deck.length) g.players[g.turn].cards.push(g.deck.pop()!);
  }
  const prev = g.turn;
  do {
    g.turn = (g.turn + 1) % g.players.length;
  } while (!g.players[g.turn].alive);
  if (g.turn <= prev) g.round++;
  startTurn(g);
  log(
    g,
    `${g.turn === 0 ? 'Du beginnst' : g.players[g.turn].name + ' beginnt'} den Zug mit ${g.reserve} Verstärkungen.`,
  );
  return true;
}
export { borderScore, aiDeploy, aiAttackChoice, aiCompleteConquest, aiFortify } from './ai';
export { validateSave } from './validation';

// One AI action, shared by animated turns and the skip button.
export function computerStep(g: GameState, progress: BotProgress, rng: Random = Math.random) {
  if (g.turn === 0 || g.winner !== null) return null;
  const beforeTurn = g.turn,
    humanWasAlive = g.players[0].alive;
  if (progress.turn !== g.turn) {
    progress.turn = g.turn;
    progress.combats = 0;
  }
  let choice: AttackChoice | null = null,
    battle: BattleResult | null = null;
  if (g.pending) aiCompleteConquest(g);
  if (g.phase === 'reinforce') aiDeploy(g, rng);
  else if (g.phase === 'attack') {
    choice = progress.combats < 65 ? aiAttackChoice(g, rng) : null;
    if (choice) {
      battle = attack(g, choice.from, choice.to, rng);
      progress.combats++;
      if (battle?.conquered) aiCompleteConquest(g);
    } else beginFortify(g);
  } else if (g.phase === 'fortify') {
    aiFortify(g);
    endTurn(g, rng);
  }
  return {
    choice,
    battle,
    turnChanged: g.turn !== beforeTurn,
    humanEliminated: humanWasAlive && !g.players[0].alive,
  };
}
export function skipComputerTurns(g: GameState, progress: BotProgress, rng: Random = Math.random) {
  const initialRound = g.round,
    humanWasAlive = g.players[0].alive;
  let steps = 0,
    humanEliminated = false;
  while (g.turn !== 0 && g.winner === null) {
    const result = computerStep(g, progress, rng);
    if (!result) break;
    steps++;
    if (result.humanEliminated) {
      humanEliminated = true;
      break;
    }
    // In spectator mode, skip one round instead of the entire remaining match.
    if (!humanWasAlive && g.round > initialRound) break;
  }
  return { steps, humanEliminated };
}
