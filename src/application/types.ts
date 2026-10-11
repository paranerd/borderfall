import type { BattleResult, GameState, MapId, Difficulty, Point } from '../game/types';
export type ModalType = 'setup' | 'menu' | 'help' | 'cards' | 'battle' | 'defeat' | 'victory';
export type Action =
  | 'hint'
  | 'stats'
  | 'cards'
  | 'new'
  | 'skip'
  | 'max'
  | 'minus'
  | 'plus'
  | 'next'
  | 'attack'
  | 'blitz'
  | 'complete'
  | 'fortify'
  | 'end';
const actions: readonly string[] = [
  'hint',
  'stats',
  'cards',
  'new',
  'skip',
  'max',
  'minus',
  'plus',
  'next',
  'attack',
  'blitz',
  'complete',
  'fortify',
  'end',
];
export const isAction = (value: string | undefined): value is Action =>
  !!value && actions.includes(value);
export const isModalType = (value: string | undefined): value is ModalType =>
  !!value && ['setup', 'menu', 'help', 'cards', 'battle', 'defeat', 'victory'].includes(value);
export interface Setup {
  opponents: number;
  difficulty: Difficulty;
  playerName: string;
  mapId: MapId;
}
export interface PhaseConfirmation {
  action: Action;
  phase: GameState['phase'];
  armedAt: number;
}
export type BattleStage = 'ready' | 'rolling' | 'settling' | 'sorting' | 'comparing' | 'result';
export interface TroopTotals {
  attacker: number;
  defender: number;
}
export interface ManualBattle {
  from: string;
  to: string;
  defender: number;
  initial: TroopTotals;
  before?: TroopTotals;
  round: number;
  result: BattleResult | null;
  stage: BattleStage;
  controller: AbortController;
}
export interface MapViewState {
  g: GameState;
  started: boolean;
  selected: string | null;
  target: string | null;
  quantity: number;
  statsPreference: boolean | null;
  modal: ModalType | null;
}
export type Gesture =
  | { type: 'pan'; point: DOMPoint; start: Point; center: Point; id: string | null | undefined }
  | { type: 'pinch'; distance: number; zoom: number; mid: Point };
