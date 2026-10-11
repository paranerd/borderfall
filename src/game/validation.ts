import { getMap, MAPS } from './maps';
import type { GameState, MapId } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum;

/** Runtime validation is required even though the engine is statically typed. */
export function validateSave(value: unknown): value is GameState {
  if (!record(value)) return false;
  const { players, board, settings, stats, pending, placements, log, deck, discard } = value;
  if (
    value.version !== 1 ||
    !Array.isArray(players) ||
    players.length < 2 ||
    players.length > 4 ||
    !integer(value.turn) ||
    value.turn >= players.length ||
    !integer(value.round, 1) ||
    !['reinforce', 'attack', 'fortify', 'finished'].includes(String(value.phase)) ||
    !integer(value.reserve) ||
    !integer(value.tradeCount) ||
    !record(board) ||
    !record(settings) ||
    !['easy', 'medium', 'hard'].includes(String(settings.difficulty)) ||
    typeof settings.fast !== 'boolean' ||
    !record(stats) ||
    !integer(stats.attacks) ||
    !integer(stats.conquests) ||
    typeof value.conquered !== 'boolean' ||
    typeof value.fortified !== 'boolean' ||
    !Array.isArray(deck) ||
    !Array.isArray(discard) ||
    !Array.isArray(log)
  )
    return false;
  if (
    settings.mapId !== undefined &&
    (typeof settings.mapId !== 'string' || !Object.hasOwn(MAPS, settings.mapId))
  )
    return false;
  if (settings.playerName !== undefined && typeof settings.playerName !== 'string') return false;
  if (value.attacked !== undefined && typeof value.attacked !== 'boolean') return false;
  if (value.resumeAttack !== undefined && typeof value.resumeAttack !== 'boolean') return false;
  const map = getMap((settings.mapId as MapId | undefined) ?? 'world');
  if (Object.keys(board).length !== map.territories.length) return false;
  for (const t of map.territories) {
    const b = board[t.id];
    if (!record(b) || !integer(b.armies, 1) || !integer(b.owner) || b.owner >= players.length)
      return false;
  }
  if (placements !== undefined) {
    if (!record(placements)) return false;
    for (const [id, count] of Object.entries(placements)) {
      const b = board[id];
      if (
        !map.byId[id] ||
        !record(b) ||
        !integer(count) ||
        count >= Number(b.armies) ||
        b.owner !== value.turn
      )
        return false;
    }
  }
  for (const [i, player] of players.entries()) {
    if (
      !record(player) ||
      player.id !== i ||
      typeof player.name !== 'string' ||
      typeof player.color !== 'string' ||
      typeof player.light !== 'string' ||
      typeof player.symbol !== 'string' ||
      !Array.isArray(player.cards) ||
      player.alive !==
        map.territories.some((t) => (board[t.id] as Record<string, unknown>).owner === i)
    )
      return false;
  }
  if (!(players[value.turn] as Record<string, unknown>).alive) return false;
  if (pending !== null) {
    if (
      !record(pending) ||
      typeof pending.from !== 'string' ||
      typeof pending.to !== 'string' ||
      !map.byId[pending.from]?.neighbors.includes(pending.to) ||
      !map.byId[pending.to] ||
      (board[pending.from] as Record<string, unknown>).owner !== value.turn ||
      (board[pending.to] as Record<string, unknown>).owner !== value.turn ||
      !integer(pending.max) ||
      pending.max !== Number((board[pending.from] as Record<string, unknown>).armies) - 1 ||
      value.phase !== 'attack'
    )
      return false;
  }
  if ((value.phase === 'finished') !== (value.winner !== null)) return false;
  if (
    !log.every(
      (l) =>
        record(l) &&
        typeof l.text === 'string' &&
        integer(l.round, 1) &&
        ['info', 'conquest', 'elimination', 'victory'].includes(String(l.type)),
    )
  )
    return false;
  const cards: unknown[] = [
    ...deck,
    ...discard,
    ...players.flatMap((p) => (p as Record<string, unknown>).cards as unknown[]),
  ];
  if (
    cards.length !== map.territories.length ||
    !cards.every(
      (c) => record(c) && typeof c.territory === 'string' && map.byId[c.territory]?.card === c.type,
    )
  )
    return false;
  if (
    new Set(cards.map((c) => (c as Record<string, unknown>).territory)).size !==
    map.territories.length
  )
    return false;
  return (
    value.winner === null ||
    (integer(value.winner) &&
      value.winner < players.length &&
      map.territories.every((t) => (board[t.id] as Record<string, unknown>).owner === value.winner))
  );
}
