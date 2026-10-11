import { waitWhileActive } from '../platform/clock';
import { MAPS, getMap } from '../game/maps';
import {
  PLAYER_STYLES,
  DEFAULT_PLAYER_NAME,
  normalizePlayerName,
  CARD_NAMES,
  SAVE_KEY,
  newGame,
  territoriesOf,
  armiesOf,
  deploy,
  undeploy,
  beginAttack,
  canAttack,
  attack,
  completeConquest,
  connected,
  beginFortify,
  fortifyPreview,
  fortify,
  endTurn,
  findSet,
  validSet,
  nextTradeValue,
  trade,
  computerStep,
  skipComputerTurns,
  validateSave,
} from '../game/engine';

import { $, escape, icon, difficultyName } from '../ui/dom';
import { createMapView } from '../ui/map';
import { renderActions } from '../ui/actions';
import { battleContent, dieFace } from '../ui/battle';
import { HELP } from '../ui/help';
import { modalWrapper, mapSelectionMarkup } from '../ui/setup';
import { loadGame, saveGame } from './saves';
import { isAction, isModalType } from './types';
import type { Action, ModalType, ManualBattle, Setup, PhaseConfirmation } from './types';
import type { GameState, BattleResult } from '../game/types';
import type { Platform } from '../platform';

export async function startApplication(platform: Platform) {
  $('#help-button').innerHTML = icon('book');
  $('#menu-button').innerHTML = icon('menu');
  $('#zoom-reset').innerHTML = icon('fit');
  $('#hint-toggle').innerHTML = icon('help');

  let saved: GameState | null = null;
  try {
    saved = await loadGame(platform.storage);
  } catch {}
  let g = saved ?? newGame();
  let started = !!saved;
  const completedConquestId = g.turn === 0 && g.pending?.max === 0 ? g.pending.to : null;
  if (completedConquestId) completeConquest(g, 0);
  let activeMap = getMap(g),
    TERRITORIES = activeMap.territories,
    BY_ID = activeMap.byId,
    CONTINENTS = activeMap.continents,
    SEA_LINKS = activeMap.seaLinks;
  let selected: string | null = g.pending?.to ?? completedConquestId,
    target: string | null = null,
    quantity = g.pending?.max ?? 1,
    lastBattle: BattleResult | null = null,
    modal: ModalType | null = null,
    helpPage = 0,
    setupStep = 0,
    setup: Setup = {
      opponents: g.players.length - 1,
      difficulty: g.settings.difficulty,
      playerName: g.players[0].name,
      mapId: activeMap.id,
    };
  const botProgress = { turn: -1, combats: 0 };
  let botTimer: ReturnType<typeof setTimeout> | undefined,
    toastTimer: ReturnType<typeof setTimeout> | undefined,
    sound = false;
  try {
    sound = (await platform.storage.get('weltmacht.sound')) === 'true';
  } catch {}
  let statsPreference: boolean | null = null;
  try {
    const stored = await platform.storage.get('weltmacht.statsCollapsed');
    if (stored === 'true' || stored === 'false') statsPreference = stored === 'true';
  } catch {}

  let hintContext: string | null = null;
  let priorFocus: HTMLElement | SVGElement | null = null,
    storageWarningShown = false,
    phaseConfirmation: PhaseConfirmation | null = null,
    attackContinuation: string | null = completedConquestId;
  let manualBattle: ManualBattle | null = null;

  function storageWarning() {
    if (!storageWarningShown) {
      storageWarningShown = true;
      toast('Dein Browser kann den Spielstand gerade nicht speichern.');
    }
  }
  function save() {
    if (started) void saveGame(platform.storage, g).catch(storageWarning);
  }
  function savePreference(key: string, value: string) {
    void platform.storage.set(key, value).catch(storageWarning);
  }
  function positionToast() {
    $('#toast').style.top = `${modal ? 12 : $('#map-canvas').getBoundingClientRect().top + 12}px`;
  }
  function toast(message: string) {
    positionToast();
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
  }
  function playTone(conquest = false) {
    if (sound) platform.audio.play(conquest);
  }
  const mapView = createMapView(
    () => ({ g, started, selected, target, quantity, statsPreference, modal }),
    selectTerritory,
    positionToast,
  );
  const {
    createMap,
    updateMap,
    updateBonuses,
    positionBonuses,
    renderScoreboard,
    updateScoreboardVisibility,
    resetZoom,
    updateZoom,
    zoomBy,
  } = mapView;
  function resetSelection() {
    selected = null;
    target = null;
    quantity = 1;
    lastBattle = null;
    phaseConfirmation = null;
  }

  function renderAction() {
    renderActions({ g, selected, target, quantity, lastBattle, phaseConfirmation }, (context) => {
      if (context !== hintContext) {
        hintContext = context;
        collapseHint();
      }
    });
  }
  function render() {
    const focusedAction = document.activeElement?.closest<HTMLElement>(
      '.floating-actions [data-action]',
    )?.dataset.action;
    renderScoreboard();
    updateMap();
    updateBonuses();
    renderAction();
    save();
    if (focusedAction) {
      const button = document.querySelector<HTMLButtonElement>(
        `.floating-actions [data-action="${focusedAction}"]`,
      );
      if (button && !button.disabled) button.focus();
      else document.querySelector<HTMLElement>('.floating-actions button:not(:disabled)')?.focus();
    }
  }

  function selectTerritory(id: string) {
    if (!started || modal || g.turn !== 0 || g.winner !== null || g.pending) return;
    if (phaseConfirmation) {
      phaseConfirmation = null;
      renderAction();
    }
    const b = g.board[id];
    if (g.phase === 'reinforce') {
      if (b.owner !== 0) {
        toast('Verstärkung kannst du nur in eigenen Gebieten platzieren.');
        return;
      }
      selected = id;
      target = null;
      quantity = Math.min(Math.max(1, quantity), g.reserve || 1);
    } else if (g.phase === 'attack') {
      if (b.owner === 0) {
        if (b.armies < 2) {
          toast('Zum Angreifen brauchst du mindestens 2 Truppen.');
          return;
        }
        selected = id;
        target = null;
        lastBattle = null;
      } else if (selected && canAttack(g, selected, id)) {
        target = id;
        lastBattle = null;
      } else {
        toast(
          selected
            ? 'Dieses Gebiet grenzt nicht an dein ausgewähltes Gebiet.'
            : 'Wähle zuerst ein eigenes Gebiet.',
        );
        return;
      }
    } else if (g.phase === 'fortify' && !g.fortified) {
      if (b.owner !== 0) {
        toast('Du kannst nur zwischen eigenen Gebieten verschieben.');
        return;
      }
      if (selected === id) {
        resetSelection();
      } else if (selected && connected(g, selected, id)) {
        target = id;
      } else if (b.armies > 1) {
        selected = id;
        target = null;
        quantity = b.armies - 1;
      } else {
        toast('Wähle zuerst ein Gebiet mit mindestens 2 Truppen.');
        return;
      }
    }
    render();
  }

  async function handleAction(action: Action) {
    if (action === 'hint') {
      const button = $('#hint-toggle'),
        expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute(
        'aria-label',
        expanded ? 'Spielhinweis einklappen' : 'Spielhinweis anzeigen',
      );
      $('#hint-content').hidden = !expanded;
      $('#map-hint').classList.toggle('expanded', expanded);
      return;
    }
    if (action === 'stats') {
      statsPreference = !$('#scoreboard-widget').classList.contains('collapsed');
      savePreference('weltmacht.statsCollapsed', String(statsPreference));
      updateScoreboardVisibility();
      positionBonuses();
      return;
    }
    if (action === 'cards') {
      openModal('cards');
      return;
    }
    if (action === 'new') {
      openModal('setup');
      return;
    }
    if (action === 'skip') {
      skipBots();
      return;
    }
    if (!started || g.turn !== 0 || modal || g.winner !== null) return;
    if (action === 'next' || action === 'end') {
      if (
        action === 'next' &&
        (g.pending ||
          !['reinforce', 'attack'].includes(g.phase) ||
          (g.phase === 'reinforce' && (g.reserve || g.players[0].cards.length >= 5)))
      )
        return;
      if (action === 'end' && g.phase !== 'fortify') return;
      const needsConfirmation =
        g.phase === 'attack' ? !(g.attacked ?? g.conquered) : g.phase === 'fortify' && !g.fortified;
      if (needsConfirmation) {
        if (phaseConfirmation?.action !== action || phaseConfirmation.phase !== g.phase) {
          phaseConfirmation = { action, phase: g.phase, armedAt: performance.now() };
          renderAction();
          $(`#turn-actions [data-action="${action}"]`).focus();
          return;
        }
        if (performance.now() - phaseConfirmation.armedAt < 350) return;
      }
      phaseConfirmation = null;
    } else phaseConfirmation = null;
    if (action === 'max') {
      if (g.pending) quantity = g.pending.max;
      else if (g.phase === 'reinforce' && selected) deploy(g, selected, g.reserve);
      else if (g.phase === 'fortify' && selected && !g.fortified)
        quantity = g.board[selected].armies - 1;
    } else if (action === 'plus' || action === 'minus') {
      const delta = action === 'plus' ? 1 : -1;
      if (g.pending) quantity = Math.max(0, Math.min(g.pending.max, quantity + delta));
      else if (g.phase === 'reinforce' && selected) {
        if (delta > 0) deploy(g, selected);
        else undeploy(g, selected);
      } else if (g.phase === 'fortify' && selected && !g.fortified)
        quantity = Math.max(1, Math.min(g.board[selected].armies - 1, quantity + delta));
    } else if (action === 'next') {
      if (g.phase === 'reinforce') {
        const resume = g.resumeAttack;
        if (beginAttack(g)) {
          resetSelection();
          if (resume) selected = attackContinuation;
        }
      } else if (g.phase === 'attack' && beginFortify(g)) {
        resetSelection();
      }
    } else if (action === 'attack' && selected && target) {
      if (canAttack(g, selected, target)) {
        manualBattle = {
          from: selected,
          to: target,
          defender: g.board[target].owner,
          initial: { attacker: g.board[selected].armies, defender: g.board[target].armies },
          round: 0,
          result: null,
          stage: 'ready',
          controller: new AbortController(),
        };
        openModal('battle');
        rollManualBattle();
      }
      return;
    } else if (action === 'blitz' && selected && target) {
      let result: BattleResult | null = null,
        attackLoss = 0,
        defendLoss = 0,
        rounds = 0;
      do {
        result = attack(g, selected, target);
        if (!result) return;
        attackLoss += result.attackLoss;
        defendLoss += result.defendLoss;
        rounds++;
      } while (action === 'blitz' && canAttack(g, selected, target));
      lastBattle = { ...result, attackLoss, defendLoss, rounds };
      playTone(!!result.conquered);
      if (g.winner !== null) {
        render();
        openModal('victory');
        return;
      }
      if (result.conquered) {
        quantity = g.pending?.max ?? 0;
        attackContinuation = target;
        selected = target;
        target = null;
        toast(`${BY_ID[selected].name} erobert!`);
      } else if (!canAttack(g, selected, target)) {
        toast('In diesem Gebiet bleibt nur noch eine Truppe.');
        target = null;
      }
    } else if (action === 'complete' && g.pending) {
      const nextFrom = g.pending.to;
      if (completeConquest(g, quantity)) {
        resetSelection();
        selected = nextFrom;
        attackContinuation = nextFrom;
        if (g.resumeAttack) toast('Erbeutete Karten: Tausche jetzt ein Set.');
      }
    } else if (action === 'fortify' && selected && target) {
      if (fortify(g, selected, target, quantity)) {
        toast(`${quantity} Truppen verschoben.`);
        endTurn(g);
        resetSelection();
        render();
        scheduleBot();
        return;
      }
    } else if (action === 'end') {
      if (endTurn(g)) {
        resetSelection();
        render();
        scheduleBot();
        return;
      }
    }
    render();
  }

  function scheduleBot() {
    clearTimeout(botTimer);
    if (!started || modal || !platform.lifecycle.isActive() || g.turn === 0 || g.winner !== null)
      return;
    botTimer = setTimeout(botStep, g.settings.fast ? 75 : 380);
  }
  function finishComputerActions(humanEliminated = false) {
    render();
    if (g.winner !== null) {
      openModal('victory');
      return;
    }
    if (humanEliminated) {
      openModal('defeat');
      return;
    }
    if (g.turn === 0) {
      resetSelection();
      botProgress.turn = -1;
      toast('Du bist am Zug. Deine Verstärkung ist bereit.');
    } else scheduleBot();
  }
  function botStep() {
    if (modal || !platform.lifecycle.isActive() || g.turn === 0 || g.winner !== null) return;
    if (botProgress.turn !== g.turn) resetSelection();
    const result = computerStep(g, botProgress);
    if (!result) return;
    if (result.choice) {
      selected = result.choice.from;
      target = result.choice.to;
      lastBattle = result.battle;
    }
    if (result.battle?.conquered) playTone(true);
    if (result.turnChanged || g.phase === 'fortify') resetSelection();
    finishComputerActions(result.humanEliminated);
  }
  function skipBots() {
    if (!started || modal || !platform.lifecycle.isActive() || g.turn === 0 || g.winner !== null)
      return;
    clearTimeout(botTimer);
    const result = skipComputerTurns(g, botProgress);
    resetSelection();
    finishComputerActions(result.humanEliminated);
  }

  function battlePause(b: ManualBattle, ms: number) {
    return waitWhileActive(platform.lifecycle, ms, b.controller.signal);
  }
  async function rollManualBattle() {
    const b = manualBattle;
    if (
      !b ||
      modal !== 'battle' ||
      !['ready', 'result'].includes(b.stage) ||
      !canAttack(g, b.from, b.to)
    )
      return;
    b.before = { attacker: g.board[b.from].armies, defender: g.board[b.to].armies };
    b.result = attack(g, b.from, b.to);
    if (!b.result) return;
    b.round++;
    b.stage = 'rolling';
    lastBattle = { ...b.result, rounds: 1 };
    if (b.result.conquered) {
      attackContinuation = b.to;
      selected = b.to;
      target = null;
      quantity = g.pending?.max ?? 0;
    } else if (!canAttack(g, b.from, b.to)) target = null;
    render();
    renderModal();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      let tick = 0;
      const tumble = setInterval(() => {
        if (!platform.lifecycle.isActive() || modal !== 'battle' || manualBattle !== b) return;
        document.querySelectorAll('.combat-die:not(.empty)').forEach((el, i) => {
          const value = ((tick + i * 2) % 6) + 1;
          el.innerHTML = dieFace(value);
          el.setAttribute('aria-label', 'Würfel rollt');
        });
        tick++;
      }, 150);
      const continueRoll = await battlePause(b, 2200);
      clearInterval(tumble);
      if (!continueRoll) return;
      b.stage = 'settling';
      renderModal();
      if (!(await battlePause(b, 1000))) return;
      b.stage = 'sorting';
      $('.combat-stage').textContent = 'Würfel werden sortiert …';
      $('.combat-footer .primary-button').innerHTML = `Sortieren … ${icon('arrow')}`;
      for (const side of ['attacker', 'defender']) {
        const dice = [
          ...document.querySelectorAll<HTMLElement>(`.combat-die[data-side="${side}"]`),
        ];
        const positions = dice.map((el) => el.getBoundingClientRect().left),
          values = side === 'attacker' ? b.result.rolledAttacker : b.result.rolledDefender;
        const order = values
          .map((value, index) => ({ value, index }))
          .sort((a, b) => b.value - a.value);
        order.forEach(({ index }, rank) => (dice[index].style.order = String(rank)));
        dice.forEach((el, i) => {
          const delta = positions[i] - el.getBoundingClientRect().left;
          el.animate(
            [
              { transform: `translate(${delta}px,0)` },
              {
                transform: `translate(${delta / 2}px,${delta === 0 ? 0 : delta > 0 ? -14 : 14}px)`,
              },
              { transform: 'translate(0,0)' },
            ],
            { duration: 1500, easing: 'cubic-bezier(.22,.7,.25,1)' },
          );
        });
      }
      if (!(await battlePause(b, 1510))) return;
      b.stage = 'comparing';
      renderModal();
      if (!(await battlePause(b, 650))) return;
    }
    if (modal !== 'battle' || manualBattle !== b || b.controller.signal.aborted) return;
    b.stage = 'result';
    renderModal();
    playTone(!!b.result.conquered);
    $('.combat-footer .primary-button').focus();
  }

  let cardSelection: number[] = [],
    cardPage = 0;
  const cardPageSize = () =>
    window.innerHeight < 500 && window.innerWidth > window.innerHeight ? 5 : 6;
  function openModal(type: ModalType) {
    if (type === 'setup') setupStep = g.winner === 0 ? 1 : 0;
    if (!modal)
      priorFocus =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
    phaseConfirmation = null;
    renderAction();
    clearTimeout(botTimer);
    modal = type;
    collapseHint();
    $('.app').inert = true;
    $('#modal-layer').classList.toggle('combat-layer', type === 'battle');
    if (type === 'cards') {
      cardSelection = findSet(g.players[0].cards) ?? [];
      cardPage = 0;
    }
    renderModal();
    $('#modal-layer').hidden = false;
    $('.modal').focus();
  }
  function closeModal() {
    const wasBattle = modal === 'battle';
    if (wasBattle) {
      manualBattle?.controller.abort();
      manualBattle = null;
    }
    modal = null;
    $('#modal-layer').hidden = true;
    $('.app').inert = false;
    $('#modal-layer').classList.remove('combat-layer');
    if (priorFocus?.isConnected) priorFocus.focus();
    else $('#menu-button').focus();
    collapseHint();
    scheduleBot();
    if (wasBattle && g.winner !== null) openModal('victory');
  }
  function positionBattle() {
    if (modal !== 'battle') return;
    const bounds = $('#map-canvas').getBoundingClientRect();
    $('#modal-layer').style.setProperty('--combat-top', `${bounds.top}px`);
    $('#modal-layer').style.setProperty(
      '--combat-bottom',
      `${window.innerHeight - bounds.bottom}px`,
    );
  }
  function renderModal() {
    let content = '';
    positionBattle();
    if (modal === 'battle' && manualBattle) {
      $('#modal-layer').innerHTML = modalWrapper(
        battleContent(g, manualBattle),
        'Manueller Angriff',
        true,
        `combat-modal ${BY_ID[manualBattle.from].name.length + BY_ID[manualBattle.to].name.length > 28 ? 'long-matchup' : ''}`,
      );
    } else if (modal === 'setup') {
      const headings = ['Dein Spielername.', 'Deine Karte.', 'Deine Gegner.'];
      const stepNames = ['Spielername', 'Karte', 'Gegner'];
      const selectedMap = getMap(setup.mapId);
      const stepContent =
        setupStep === 0
          ? `<div class="name-field"><label class="field-label" for="player-name">SPIELERNAME</label><input id="player-name" class="name-input" type="text" maxlength="20" autocomplete="nickname" value="${escape(setup.playerName)}" placeholder="${DEFAULT_PLAYER_NAME}"></div>`
          : setupStep === 1
            ? mapSelectionMarkup(setup)
            : `<p class="setup-summary">${escape(setup.playerName)} · ${selectedMap.name} · ${selectedMap.territories.length} Gebiete</p><div class="setup-grid"><div><span class="field-label">COMPUTERGEGNER</span><div class="segment" aria-label="Anzahl Computergegner">${[1, 2, 3].map((n) => `<button data-opponents="${n}" class="${setup.opponents === n ? 'chosen' : ''}" aria-pressed="${setup.opponents === n}">${n} Gegner</button>`).join('')}</div></div><div><span class="field-label">SCHWIERIGKEIT</span><div class="segment" aria-label="Schwierigkeitsgrad">${['easy', 'medium', 'hard'].map((d) => `<button data-difficulty="${d}" class="${setup.difficulty === d ? 'chosen' : ''}" aria-pressed="${setup.difficulty === d}">${difficultyName(d)}</button>`).join('')}</div></div></div>`;
      content = `<span class="eyebrow">NEUE PARTIE · SCHRITT ${setupStep + 1} VON 3</span><h2>${headings[setupStep]}</h2><ol class="setup-steps" aria-label="Einrichtungsschritte">${stepNames.map((name, i) => `<li class="${i === setupStep ? 'current' : i < setupStep ? 'done' : ''}" ${i === setupStep ? 'aria-current="step"' : ''}><span>${i + 1}</span>${name}</li>`).join('')}</ol><div class="setup-step-content" data-step="${setupStep}">${stepContent}</div><div class="setup-footer">${setupStep > 0 ? '<button class="secondary-button" data-modal="setup-back">Zurück</button>' : ''}<button class="primary-button" data-modal="${setupStep < 2 ? 'setup-next' : 'start'}">${setupStep < 2 ? 'Weiter' : started ? 'Neue Partie starten' : 'Spiel starten'} ${icon('arrow')}</button></div>`;
      $('#modal-layer').innerHTML = modalWrapper(
        content,
        'Neue Partie einrichten',
        true,
        'setup-wizard',
      );
    } else if (modal === 'menu') {
      content = `<span class="eyebrow">KOMMANDOZENTRALE</span><h2>Eine kurze Verschnaufpause.</h2><p class="setup-summary">${activeMap.name} · ${difficultyName(g.settings.difficulty)}</p><p class="modal-intro">Runde ${g.round} · ${territoriesOf(g, 0).length} deiner ${TERRITORIES.length} Gebiete.</p><div class="menu-stack"><button class="secondary-button" data-modal="help">Spielregeln & Bedienung</button><button class="secondary-button" data-modal="speed">Computerzüge: ${g.settings.fast ? 'Schnell' : 'Normal'}</button><button class="secondary-button" data-modal="sound">Sound: ${sound ? 'Ein' : 'Aus'}</button><button class="secondary-button" data-modal="setup">Neue Partie einrichten</button></div>`;
      $('#modal-layer').innerHTML = modalWrapper(content, 'Spielmenü');
    } else if (modal === 'help') {
      const h = HELP[helpPage];
      content = `<span class="eyebrow">DAS KOMMANDANTEN-HANDBUCH</span><h2>Ein Plan für die Welt.</h2><div class="help-tabs">${HELP.map((p, i) => `<button class="${i === helpPage ? 'chosen' : ''}" data-help="${i}" aria-pressed="${i === helpPage}">${p.tab}</button>`).join('')}</div><div class="help-content"><h3>${helpPage === 0 ? `${TERRITORIES.length} Gebiete. ${activeMap.name}.` : h.title}</h3><p>${h.text}</p><p>${h.text2}</p><div class="help-example">${helpPage === 1 ? CONTINENTS.map((c) => `${c.name} +${c.bonus}`).join(' · ') : h.example}</div></div><div class="help-bottom"><span>${helpPage + 1} / ${HELP.length}</span><button class="primary-button" data-modal="${helpPage === 4 ? 'close' : 'help-next'}">${helpPage === 4 ? 'Los geht’s' : 'Weiter'} ${icon('arrow')}</button></div>`;
      $('#modal-layer').innerHTML = modalWrapper(
        content,
        'Spielregeln und Bedienung',
        true,
        'help-modal',
      );
    } else if (modal === 'cards') {
      const cards = g.players[0].cards;
      const pageSize = cardPageSize();
      const pages = Math.max(1, Math.ceil(cards.length / pageSize));
      cardPage = Math.min(cardPage, pages - 1);
      const shown = cards.slice(cardPage * pageSize, (cardPage + 1) * pageSize);
      const allowed = g.turn === 0 && g.phase === 'reinforce' && g.winner === null;
      const valid = cardSelection.length === 3 && validSet(cardSelection.map((i) => cards[i]));
      content = `<span class="eyebrow">DEINE GEBIETSKARTEN</span><h2>Erfolge zahlen sich aus.</h2><p class="modal-intro">Drei gleiche Symbole oder je eines von jeder Art. Das nächste Set bringt <strong>${nextTradeValue(g)} Truppen</strong>.${cards.length >= 5 ? '<br><strong>Du musst ein Set tauschen, bevor du angreifst.</strong>' : ''}</p>${
        cards.length
          ? `<div class="card-list">${shown
              .map((c, j) => {
                const i = cardPage * pageSize + j;
                return `<button title="${BY_ID[c.territory].name} · ${CARD_NAMES[c.type]}" aria-label="${BY_ID[c.territory].name}, ${CARD_NAMES[c.type]}" class="game-card ${cardSelection.includes(i) ? 'chosen' : ''}" data-card="${i}" aria-pressed="${cardSelection.includes(i)}">${icon(['infantry', 'cavalry', 'artillery'][c.type])}<b>${BY_ID[c.territory].name}</b><span>${CARD_NAMES[c.type]}</span></button>`;
              })
              .join(
                '',
              )}</div>${pages > 1 ? `<div class="card-pagination"><button data-card-page="${cardPage - 1}" ${cardPage === 0 ? 'disabled' : ''} aria-label="Vorherige Karten">←</button><span>Seite ${cardPage + 1} / ${pages} · ${cardSelection.length} / 3 gewählt</span><button data-card-page="${cardPage + 1}" ${cardPage === pages - 1 ? 'disabled' : ''} aria-label="Nächste Karten">→</button></div>` : ''}`
          : '<div class="help-example">Erobere mindestens ein Gebiet und beende deinen Zug, um deine erste Karte zu erhalten.</div>'
      }<p class="modal-intro" style="margin-top:12px">${allowed ? 'Wähle drei Karten für deinen Tausch. Eine eigene passende Gebietskarte gibt zusätzlich +2 Truppen.' : 'Tauschen ist in deiner Verstärkungsphase möglich.'}</p><button class="primary-button card-trade" data-modal="trade" ${allowed && valid ? '' : 'disabled'}>Set tauschen · +${nextTradeValue(g)} Truppen ${icon('arrow')}</button>`;
      $('#modal-layer').innerHTML = modalWrapper(content, 'Gebietskarten');
    } else if (modal === 'defeat') {
      content = `<span class="eyebrow">DEIN FELDZUG IST BEENDET</span><h2>Die letzte Grenze ist gefallen.</h2><p class="modal-intro">Deine Gebiete wurden erobert. Du kannst eine neue Partie starten oder den verbleibenden Gegnern bis zur Welteroberung zusehen.</p><div class="victory-stats"><span><strong>${g.round}</strong>Runden</span><span><strong>${g.stats.attacks}</strong>Kämpfe insgesamt</span></div><div class="setup-footer"><button class="secondary-button" data-modal="close">Weiter zusehen</button><button class="primary-button" data-modal="setup">Neue Partie planen</button></div>`;
      $('#modal-layer').innerHTML = modalWrapper(content, 'Du wurdest besiegt');
    } else if (modal === 'victory') {
      const won = g.winner === 0;
      content = `<span class="eyebrow">${won ? 'DEIN FELDZUG IST VOLLENDET' : 'DIE PARTIE IST ENTSCHIEDEN'}</span><h2>${won ? `${activeMap.id === 'europe' ? 'Europa' : 'Die Welt'} gehört dir.` : `${escape(g.players[g.winner!].name)} erobert ${activeMap.id === 'europe' ? 'Europa' : 'die Welt'}.`}</h2><div class="victory-number">${TERRITORIES.length} / ${TERRITORIES.length}</div><p class="modal-intro">${won ? 'Du hast alle Regionen vereint. Eine Strategie, die Geschichte schreibt.' : 'Jede Partie ist eine neue Chance. Ordne deine Truppen und starte den nächsten Feldzug.'}</p><div class="victory-stats"><span><strong>${g.round}</strong>Runden</span><span><strong>${g.stats.attacks}</strong>Kämpfe insgesamt</span><span><strong>${g.stats.conquests}</strong>Eroberungen insgesamt</span></div><button class="primary-button" data-modal="setup">Neue Partie planen ${icon('arrow')}</button>`;
      $('#modal-layer').innerHTML = modalWrapper(content, 'Partie beendet');
    }
  }

  function changeSetupStep(delta: number) {
    if (setupStep === 0 && delta > 0) setup.playerName = normalizePlayerName(setup.playerName);
    setupStep = Math.max(0, Math.min(2, setupStep + delta));
    renderModal();
    if (setupStep === 0) $('#player-name').focus();
    else $('.setup-step-content .chosen')?.focus();
  }
  async function startGame() {
    setup.playerName = normalizePlayerName(setup.playerName);
    g = newGame({ ...setup, fast: g.settings.fast });
    activeMap = getMap(g);
    ({
      territories: TERRITORIES,
      byId: BY_ID,
      continents: CONTINENTS,
      seaLinks: SEA_LINKS,
    } = activeMap);
    attackContinuation = null;
    started = true;
    botProgress.turn = -1;
    botProgress.combats = 0;
    resetSelection();
    createMap();
    resetZoom();
    render();
    closeModal();
    let introduced = false;
    try {
      introduced = (await platform.storage.get('weltmacht.introduced')) === 'true';
      await platform.storage.set('weltmacht.introduced', 'true');
    } catch {}
    if (!introduced) {
      helpPage = 0;
      openModal('help');
    } else toast('Deine erste Verstärkung wartet. Viel Erfolg!');
  }

  $('#modal-layer').addEventListener('click', (event) => {
    if (event.target === $('#modal-layer')) {
      closeModal();
      return;
    }
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.map === 'world' || button.dataset.map === 'europe') {
      setup.mapId = button.dataset.map;
      renderModal();
      return;
    }
    if (button.dataset.opponents) {
      setup.opponents = Number(button.dataset.opponents);
      renderModal();
      return;
    }
    if (
      button.dataset.difficulty === 'easy' ||
      button.dataset.difficulty === 'medium' ||
      button.dataset.difficulty === 'hard'
    ) {
      setup.difficulty = button.dataset.difficulty;
      renderModal();
      return;
    }
    if (button.dataset.help !== undefined) {
      helpPage = Number(button.dataset.help);
      renderModal();
      return;
    }
    if (button.dataset.cardPage !== undefined) {
      cardPage = Number(button.dataset.cardPage);
      renderModal();
      return;
    }
    if (button.dataset.card !== undefined) {
      const i = Number(button.dataset.card);
      if (cardSelection.includes(i)) cardSelection = cardSelection.filter((n) => n !== i);
      else if (cardSelection.length < 3) cardSelection.push(i);
      else {
        toast('Wähle höchstens drei Karten.');
        return;
      }
      renderModal();
      return;
    }
    const action = button.dataset.modal;
    if (action === 'close') {
      closeModal();
    } else if (action === 'battle-next') {
      if (manualBattle?.stage !== 'result') return;
      if (canAttack(g, manualBattle.from, manualBattle.to)) rollManualBattle();
      else closeModal();
    } else if (action === 'setup-next') {
      changeSetupStep(1);
    } else if (action === 'setup-back') {
      changeSetupStep(-1);
    } else if (action === 'start') {
      startGame();
    } else if (action === 'help-next') {
      helpPage = Math.min(4, helpPage + 1);
      renderModal();
    } else if (action === 'help') {
      helpPage = 0;
      openModal('help');
    } else if (action === 'sound') {
      toggleSound();
      renderModal();
    } else if (action === 'speed') {
      g.settings.fast = !g.settings.fast;
      save();
      render();
      renderModal();
    } else if (action === 'trade') {
      if (trade(g, cardSelection)) {
        render();
        closeModal();
        toast('Kartenset getauscht. Deine Verstärkung ist bereit.');
      }
    } else if (isModalType(action)) openModal(action);
  });
  $('#modal-layer').addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.id === 'player-name')
      setup.playerName = event.target.value;
  });
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const el = event.target.closest<HTMLButtonElement>('[data-action]');
    if (el && !el.disabled && isAction(el.dataset.action)) void handleAction(el.dataset.action);
  });
  $('#menu-button').addEventListener('click', () => openModal(started ? 'menu' : 'setup'));
  function openHelp() {
    helpPage = 0;
    openModal('help');
  }
  $('#help-button').addEventListener('click', openHelp);
  function toggleSound() {
    sound = !sound;
    savePreference('weltmacht.sound', String(sound));
    if (sound) playTone();
  }
  document.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element)) return;
    if (modal === 'setup' && event.key === 'Enter' && event.target.id === 'player-name') {
      event.preventDefault();
      changeSetupStep(1);
      return;
    }
    if (
      !modal &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
    ) {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomBy(1.3);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        zoomBy(1 / 1.3);
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        resetZoom();
        return;
      }
    }
    if (!modal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
    if (event.key === 'Tab') {
      const els = [
        ...$('.modal').querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),a[href]',
        ),
      ];
      if (!els.length) return;
      const first = els[0],
        last = els.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === $('.modal'))
      ) {
        last!.focus();
        event.preventDefault();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === $('.modal'))
      ) {
        first.focus();
        event.preventDefault();
      }
    }
  });

  function collapseHint() {
    $('#map-hint').classList.remove('expanded');
    $('#hint-content').hidden = true;
    $('#hint-toggle').setAttribute('aria-expanded', 'false');
    $('#hint-toggle').setAttribute('aria-label', 'Spielhinweis anzeigen');
  }
  for (const eventType of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'input']) {
    document.addEventListener(
      eventType,
      (event) => {
        if (event.target instanceof Element && event.target.closest('#map-hint')) return;
        collapseHint();
      },
      { capture: true, passive: true },
    );
  }

  window.addEventListener('resize', () => {
    updateScoreboardVisibility();
    positionBonuses();
    positionBattle();
    if (modal === 'cards') renderModal();
  });
  new ResizeObserver(() => {
    updateScoreboardVisibility();
    positionBonuses();
  }).observe($('#map-canvas'));
  new ResizeObserver(positionBonuses).observe($('#scoreboard-widget'));
  let pausedAnimations: Animation[] = [];
  platform.lifecycle.subscribe((active) => {
    collapseHint();
    if (!active) {
      clearTimeout(botTimer);
      platform.audio.pause();
      save();
      pausedAnimations.push(...document.getAnimations().filter((a) => a.playState === 'running'));
      pausedAnimations.forEach((a) => a.pause());
    } else {
      pausedAnimations.forEach((a) => a.play());
      pausedAnimations = [];
      scheduleBot();
    }
  });
  createMap();
  render();
  updateZoom();
  openModal('setup');
  return {
    save: async () => {
      save();
      await platform.storage.flush();
    },
    canUpdate: () => modal !== 'battle',
  };
}
