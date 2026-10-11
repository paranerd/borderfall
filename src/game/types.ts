export type MapId = 'world' | 'europe';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Phase = 'reinforce' | 'attack' | 'fortify' | 'finished';
export type CardType = 0 | 1 | 2;
export type Random = () => number;
export interface Point {
  x: number;
  y: number;
}
export interface Territory extends Point {
  id: string;
  name: string;
  continent: string;
  abbr?: string;
  points: string;
  card: CardType;
  neighbors: string[];
}
export interface Region {
  id: string;
  name: string;
  bonus: number;
  color: string;
}
export interface GameMap {
  id: MapId;
  name: string;
  description: string;
  territories: Territory[];
  byId: Record<string, Territory>;
  continents: Region[];
  seaLinks: [string, string][];
  startingArmies: [number, number, number];
  bonuses: Record<string, Point>;
  oceans: (Point & { text: string; rotate?: number })[];
  wrap: boolean;
}
export interface Card {
  territory: string;
  type: CardType;
}
export interface PlayerStyle {
  name: string;
  color: string;
  light: string;
  symbol: string;
}
export interface Player extends PlayerStyle {
  id: number;
  cards: Card[];
  alive: boolean;
}
export interface BoardEntry {
  owner: number;
  armies: number;
}
export interface PendingConquest {
  from: string;
  to: string;
  max: number;
}
export type LogType = 'info' | 'conquest' | 'elimination' | 'victory';
export interface GameLog {
  text: string;
  type: LogType;
  round: number;
}
export interface GameSettings {
  difficulty: Difficulty;
  fast: boolean;
  playerName?: string;
  mapId?: MapId;
}
export interface GameOptions {
  opponents?: number;
  difficulty?: Difficulty;
  fast?: boolean;
  playerName?: string;
  mapId?: MapId;
}
export interface GameState {
  version: 1;
  players: Player[];
  board: Record<string, BoardEntry>;
  turn: number;
  round: number;
  phase: Phase;
  reserve: number;
  attacked?: boolean;
  conquered: boolean;
  fortified: boolean;
  tradeCount: number;
  deck: Card[];
  discard: Card[];
  log: GameLog[];
  winner: number | null;
  settings: GameSettings;
  stats: { attacks: number; conquests: number };
  resumeAttack?: boolean;
  pending: PendingConquest | null;
  placements?: Record<string, number>;
}
export interface DiceResult {
  attackLoss: number;
  defendLoss: number;
  attacker: number[];
  defender: number[];
}
export interface BattleResult extends DiceResult {
  rolledAttacker: number[];
  rolledDefender: number[];
  conquered?: boolean;
  rounds?: number;
}
export interface AttackChoice {
  from: string;
  to: string;
  score: number;
}
export interface BotProgress {
  turn: number;
  combats: number;
}
