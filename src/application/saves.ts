import { DEFAULT_PLAYER_NAME, PLAYER_STYLES, normalizePlayerName, SAVE_KEY } from '../game/engine';
import { validateSave } from '../game/validation';
import type { GameState } from '../game/types';
import type { KeyValueStorage } from '../platform/storage';

export async function loadGame(storage: KeyValueStorage): Promise<GameState | null> {
  const raw = await storage.get(SAVE_KEY);
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!validateSave(data)) return null;
  data.players = data.players.map((p, i) => ({
    ...p,
    ...PLAYER_STYLES[i],
    name:
      i === 0
        ? normalizePlayerName(
            p.name === 'Du' && !data.settings.playerName ? DEFAULT_PLAYER_NAME : p.name,
          )
        : PLAYER_STYLES[i].name,
    id: i,
  }));
  data.placements ??= {};
  data.resumeAttack ??= false;
  data.attacked ??= data.conquered;
  data.settings.mapId ??= 'world';
  return data;
}

export function saveGame(storage: KeyValueStorage, game: GameState): Promise<void> {
  return storage.set(SAVE_KEY, JSON.stringify(game));
}
