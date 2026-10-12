import { $, escape, icon } from './dom';
import { canAttack, findSet } from '../game/engine';
import { getMap } from '../game/maps';
import type { GameState, BattleResult } from '../game/types';
import type { Action, PhaseConfirmation } from '../application/types';
interface ActionState {
  g: GameState;
  selected: string | null;
  target: string | null;
  quantity: number;
  lastBattle: BattleResult | null;
  phaseConfirmation: PhaseConfirmation | null;
}
export function renderActions(state: ActionState) {
  const { g, selected, target, quantity, lastBattle, phaseConfirmation } = state;
  const activeMap = getMap(g),
    TERRITORIES = activeMap.territories,
    BY_ID = activeMap.byId;
  function stepper(
    value: number,
    label: string,
    minusDisabled: boolean,
    plusDisabled: boolean,
    max = 0,
  ) {
    const distributing = g.phase === 'reinforce' && !g.pending;
    const maxLabel = distributing
      ? `Alle ${max} Truppen platzieren`
      : `Maximal ${max} Truppen wählen`;
    return `<div class="troop-stepper"><button data-action="minus" aria-label="${distributing ? 'Truppe zurücknehmen' : 'Eine Truppe weniger'}" ${minusDisabled ? 'disabled' : ''}>−</button><div class="stepper-count"><output aria-label="${label}" style="--digits:${String(value).length}">${value}</output><span class="sr-only">${label}</span></div><button data-action="plus" aria-label="${distributing ? 'Truppe platzieren' : 'Eine Truppe mehr'}" ${plusDisabled ? 'disabled' : ''}>+</button>${max >= 5 ? `<button class="max-button" data-action="max" aria-label="${maxLabel}" title="${maxLabel}" ${plusDisabled ? 'disabled' : ''}>Max</button>` : ''}</div>`;
  }
  function checkButton(action: Action, label: string, disabled = false) {
    return `<button class="primary-button check-button" data-action="${action}" ${disabled ? 'disabled' : ''} aria-label="${label}" title="${label}">${icon('check')}</button>`;
  }
  function phaseButton(action: Action, label: string, confirmLabel: string) {
    const armed = phaseConfirmation?.action === action && phaseConfirmation.phase === g.phase;
    const shortLabel = armed ? confirmLabel : action === 'end' ? 'Zugende' : 'Weiter';
    return `<button class="primary-button phase-button ${armed ? 'confirming' : ''}" data-action="${action}" aria-label="${armed ? confirmLabel : label}" title="${armed ? confirmLabel : label}"><span class="button-full">${armed ? confirmLabel : label}</span><span class="button-short" aria-hidden="true">${shortLabel}</span>${icon('arrow')}</button>`;
  }
  function battleMarkup() {
    if (!lastBattle) return '';
    return `<div class="battle-result"><div class="battle-dice" aria-label="Angriffswürfel ${lastBattle.attacker.join(', ')}, Verteidigungswürfel ${lastBattle.defender.join(', ')}">${lastBattle.attacker.map((n) => `<span class="dice">${n}</span>`).join('')}<span class="dice-divider">/</span>${lastBattle.defender.map((n) => `<span class="dice defend">${n}</span>`).join('')}</div><span class="battle-caption">Du −${lastBattle.attackLoss} · Gegner −${lastBattle.defendLoss}${(lastBattle.rounds ?? 1) > 1 ? ' · ' + lastBattle.rounds + '×' : ''}</span></div>`;
  }
  function renderAction() {
    const human = g.turn === 0 && g.winner === null,
      phase = g.phase;
    let title = '',
      desc = '',
      controls = '',
      action = '';
    if (g.winner !== null) {
      title =
        g.winner === 0
          ? `${activeMap.name === 'Europa' ? 'Europa' : 'Die Welt'} gehört dir.`
          : 'Partie beendet.';
      desc = `${g.players[g.winner].name} kontrolliert alle ${TERRITORIES.length} Gebiete.`;
      action =
        '<button class="primary-button" data-action="new" aria-label="Neue Partie"><span class="button-full">Neue Partie ↗</span><span class="button-short" aria-hidden="true">Neu</span></button>';
    } else if (!human) {
      title = `${g.players[g.turn].name} ist am Zug.`;
      desc =
        phase === 'reinforce'
          ? 'Verstärkt seine Grenzen.'
          : phase === 'attack'
            ? 'Plant die nächste Eroberung.'
            : 'Ordnet seine Truppen neu.';
      controls = '';
      action =
        '<button class="primary-button" data-action="skip" aria-label="Computerzüge überspringen" title="Alle verbleibenden Computerzüge bis zu deinem nächsten Zug ausführen">Überspringen</button>';
    } else if (g.pending) {
      title = 'Gebiet erobert!';
      desc = `${BY_ID[g.pending.from].name} → ${BY_ID[g.pending.to].name}`;
      controls = stepper(
        quantity,
        'nachziehen',
        quantity === 0,
        quantity >= g.pending.max,
        g.pending.max,
      );
      controls += checkButton(
        'complete',
        quantity ? 'Nachziehen bestätigen' : 'Ohne Nachziehen bestätigen',
      );
    } else if (phase === 'reinforce') {
      title = selected ? BY_ID[selected].name : 'Neue Truppen';
      desc = selected
        ? 'Mit + setzen, mit − zurücknehmen.'
        : 'Wähle ein eigenes Gebiet auf der Karte.';
      controls =
        g.reserve > 0
          ? stepper(
              g.reserve,
              'verfügbar',
              !selected || !((g.placements?.[selected] ?? 0) > 0),
              !selected || g.reserve === 0,
              g.reserve,
            )
          : '';
      if (g.players[0].cards.length >= 5)
        action =
          '<button class="primary-button" data-action="cards" aria-label="Kartenset tauschen"><span class="button-full">Kartenset tauschen ↗</span><span class="button-short" aria-hidden="true">Tauschen</span></button>';
      else if (g.reserve === 0)
        action = phaseButton(
          'next',
          g.resumeAttack ? 'Angriff fortsetzen' : 'Zum Angriff',
          'Angriff bestätigen',
        );
    } else if (phase === 'attack') {
      title = selected
        ? target
          ? `${BY_ID[selected].name} → ${BY_ID[target].name}`
          : BY_ID[selected].name
        : 'Angreifen';
      desc = selected
        ? target
          ? 'Wähle manuellen Angriff oder Blitzangriff.'
          : 'Wähle einen markierten Gegner.'
        : 'Wähle ein eigenes Gebiet mit mindestens 2 Truppen.';
      const ready = !!target && canAttack(g, selected, target);
      controls = ready
        ? `<div class="attack-buttons"><button class="primary-button" data-action="attack" aria-label="Angreifen" title="Manueller Angriff mit sichtbaren Würfeln"><span class="button-full">Angreifen</span><span class="button-short" aria-hidden="true">Wurf</span>${icon('attack')}</button><button class="primary-button blitz-button" data-action="blitz" title="Kämpft bis zur Eroberung oder bis nur eine eigene Truppe bleibt" aria-label="Blitzangriff"><span class="button-full">Blitzangriff</span><span class="button-short" aria-hidden="true">Blitz</span>${icon('blitz')}</button></div>`
        : '';
      if (!target) action = phaseButton('next', 'Zum Verschieben', 'Weiter ohne Angriff?');
    } else {
      title = g.fortified
        ? 'Truppen verschoben'
        : selected
          ? target
            ? `${BY_ID[selected].name} → ${BY_ID[target].name}`
            : BY_ID[selected].name
          : 'Truppen verschieben';
      desc = g.fortified
        ? 'Deine Verschiebung ist abgeschlossen.'
        : selected
          ? target
            ? `Vorschau: ${quantity} Truppen verschieben. Eine bleibt zurück.`
            : 'Wähle ein verbundenes eigenes Zielgebiet.'
          : 'Wähle ein eigenes Gebiet mit mindestens 2 Truppen.';
      if (!g.fortified && selected && target) {
        controls = stepper(
          selected ? quantity : 0,
          'verschieben',
          !selected || quantity <= 1,
          !selected || quantity >= g.board[selected].armies - 1,
          selected ? g.board[selected].armies - 1 : 0,
        );
        controls += checkButton('fortify', 'Truppen verschieben', !target);
      }
      if (!target)
        action = g.fortified
          ? `<button class="primary-button phase-button" data-action="end" aria-label="Zug beenden" title="Zug beenden"><span class="button-full">Zug beenden</span><span class="button-short" aria-hidden="true">Zugende</span>${icon('arrow')}</button>`
          : phaseButton('end', 'Zug beenden', 'Wirklich beenden?');
    }
    $('#action-card').dataset.phase = g.pending ? 'conquest' : phase;
    $('#action-card').setAttribute('aria-label', `${title}. ${desc}`);
    const phaseLabel = g.pending
      ? 'Nachziehen'
      : {
          reinforce: 'Verstärkung',
          attack: 'Angriff',
          fortify: 'Bewegen',
          finished: 'Partie beendet',
        }[phase];
    $('#action-card').innerHTML = `<div class="action-controls">${controls}</div>`;
    $('#action-card').hidden = !controls;
    $('#phase-label').innerHTML =
      !human && g.winner === null
        ? `<i class="spinner" aria-hidden="true"></i><span>${escape(g.players[g.turn].name)} ist am Zug</span>`
        : escape(phaseLabel);
    const canTrade = human && phase === 'reinforce' && !!findSet(g.players[0].cards);
    $('#cards-bar').innerHTML =
      `<button data-action="cards" aria-label="${g.players[0].cards.length} Gebietskarten ${canTrade ? 'tauschen' : 'ansehen'}" title="Gebietskarten ${canTrade ? 'tauschen' : 'ansehen'}">${icon('cards')}<span class="card-count">${g.players[0].cards.length}</span>${canTrade ? '<span class="card-alert" aria-hidden="true">!</span>' : ''}</button>`;
    $('#turn-actions').innerHTML = action;
    $('#turn-actions').hidden = !action;
    const hints =
      !human || g.winner !== null
        ? `${title} ${desc}`
        : selected || g.pending
          ? `${title} · ${desc}`
          : desc;
    $('#hint-content').innerHTML =
      `<span class="hint-text">${escape(hints)}</span>${human && phase === 'attack' && !g.pending ? battleMarkup() : ''}`;
  }

  renderAction();
}
