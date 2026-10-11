import { escape, icon } from './dom';
import { canAttack } from '../game/engine';
import { getMap } from '../game/maps';
import type { GameState, Player, BattleResult } from '../game/types';
import type { ManualBattle } from '../application/types';
const pipPositions: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
export function dieFace(value: number) {
  return pipPositions[value]
    .map(
      (position) =>
        `<i style="grid-area:${Math.ceil(position / 3)}/${((position - 1) % 3) + 1}" aria-hidden="true"></i>`,
    )
    .join('');
}
function battleDice(
  values: number[],
  side: 'attacker' | 'defender',
  sorted = false,
  compared = 0,
  result: BattleResult | null = null,
) {
  const order = values.map((value, index) => ({ value, index }));
  if (sorted) order.sort((a, b) => b.value - a.value);
  return order
    .map(({ value, index }, rank) => {
      const outcome =
        result && rank < compared
          ? result.attacker[rank] > result.defender[rank]
            ? 'attacker'
            : 'defender'
          : null;
      return `<div class="combat-die ${sorted && rank >= compared ? 'unused' : ''} ${outcome === side ? 'winning' : ''}" data-side="${side}" data-die="${index}" aria-label="${value} Augen" style="order:${rank}">${dieFace(value)}</div>`;
    })
    .join('');
}
function battleTroopTile(
  b: ManualBattle,
  side: 'attacker' | 'defender',
  player: Player,
  current: number,
) {
  const before = b.initial[side],
    changed = before !== current;
  return `<div class="combat-troop-tile" data-combat-player="${side}" style="--combat-color:${player.color}"><span class="combat-avatar">${player.symbol}</span><div class="combat-troop-identity"><b title="${escape(player.name)}">${escape(player.name)}</b><small>${side === 'attacker' ? 'Angreifer' : 'Verteidiger'}</small></div><div class="combat-troop-total"><div class="combat-troop-count">${changed ? `<span class="combat-troop-history" aria-label="vorher ${before}">${before} <i aria-hidden="true">→</i></span>` : ''}<strong aria-label="${current} ${side === 'attacker' ? 'eigene' : 'gegnerische'} Truppen">${current}</strong></div></div></div>`;
}
export function battleContent(g: GameState, b: ManualBattle) {
  const BY_ID = getMap(g).byId;
  const r = b.result,
    finished = b.stage === 'result',
    busy = !finished;
  const attacker = g.players[0],
    defender = g.players[b.defender];
  if (finished && !r) throw new Error('Battle result is missing');
  const compared = r ? Math.min(r!.attacker.length, r!.defender.length) : 0;
  const sorted = ['comparing', 'result'].includes(b.stage);
  const armies = finished
    ? { attacker: g.board[b.from].armies, defender: r?.conquered ? 0 : g.board[b.to].armies }
    : (b.before ?? { attacker: g.board[b.from].armies, defender: g.board[b.to].armies });
  const stageText = (
    {
      ready: 'Der Angriff beginnt …',
      rolling: 'Die Würfel rollen …',
      settling: 'Die Würfel sind gefallen.',
      sorting: 'Würfel werden sortiert …',
      comparing: 'Die höchsten Würfel werden verglichen …',
    } as Record<string, string>
  )[b.stage];
  const nextLabel = r?.conquered
    ? g.winner !== null
      ? 'Zum Ergebnis'
      : 'Fertig'
    : canAttack(g, b.from, b.to)
      ? 'Nächste Runde'
      : 'Zur Karte';
  const busyLabel =
    b.stage === 'sorting' ? 'Sortieren …' : b.stage === 'comparing' ? 'Vergleichen …' : 'Würfeln …';
  return `<span class="eyebrow">WÜRFELRUNDE ${b.round}</span><h2 title="${escape(BY_ID[b.from].name)} → ${escape(BY_ID[b.to].name)}">${escape(BY_ID[b.from].name)} <span>→</span> ${escape(BY_ID[b.to].name)}</h2>
    <div class="combat-troops" aria-live="polite">${battleTroopTile(b, 'attacker', attacker, armies.attacker)}${battleTroopTile(b, 'defender', defender, armies.defender)}</div>
    <div class="combat-rolls ${b.stage === 'rolling' ? 'rolling' : ''}" aria-label="Würfelvergleich" aria-busy="${busy}">
      <div class="combat-dice-row attacker" style="--dice-color:${attacker.color}"><span>Angriff</span><div class="combat-dice-track">${r ? battleDice(r!.rolledAttacker, 'attacker', sorted, compared, finished ? r : null) : ''}</div></div>
      <div class="combat-comparisons" aria-hidden="${!finished}">${
        finished
          ? r!.defender
              .slice(0, compared)
              .map(
                (n, i) =>
                  `<span class="${r!.attacker[i] > n ? 'defender-loss' : 'attacker-loss'}">${r!.attacker[i]} ${r!.attacker[i] > n ? '›' : r!.attacker[i] === n ? '=' : '‹'} ${n}<small>${r!.attacker[i] > n ? escape(defender.name) : 'Du'} −1</small></span>`,
              )
              .join('')
          : ''
      }</div>
      <div class="combat-dice-row defender" style="--dice-color:${defender.color}"><span>Abwehr</span><div class="combat-dice-track">${r ? battleDice(r!.rolledDefender, 'defender', sorted, compared, finished ? r : null) : ''}${r && r!.rolledDefender.length < r!.rolledAttacker.length ? '<div class="combat-die empty" aria-hidden="true">–</div>'.repeat(r!.rolledAttacker.length - r!.rolledDefender.length) : ''}</div></div>
    </div>
    <span class="sr-only combat-stage" role="status" aria-live="polite">${finished ? (r!.conquered ? `${escape(BY_ID[b.to].name)} erobert.` : `Du verlierst ${r!.attackLoss}, ${escape(defender.name)} verliert ${r!.defendLoss} Truppen.`) : stageText}</span>
    <div class="combat-footer">${finished && canAttack(g, b.from, b.to) ? '<button class="secondary-button" data-modal="close" title="Diesen Angriff beenden; dein Zug geht weiter">Aufgeben</button>' : ''}<button class="primary-button" data-modal="battle-next" ${busy ? 'disabled' : ''}>${busy ? busyLabel : nextLabel} ${icon('arrow')}</button></div>`;
}
