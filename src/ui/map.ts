import { $, escape } from './dom';
import { getMap } from '../game/maps';
import { territoriesOf, armiesOf, canAttack, connected, fortifyPreview } from '../game/engine';
import type { Point, Territory } from '../game/types';
import type { MapViewState, Gesture } from '../application/types';
export function createMapView(
  getState: () => MapViewState,
  selectTerritory: (id: string) => void,
  positionToast: () => void,
) {
  let activeMap = getMap(getState().g),
    TERRITORIES = activeMap.territories,
    BY_ID = activeMap.byId,
    CONTINENTS = activeMap.continents,
    SEA_LINKS = activeMap.seaLinks;
  let zoom = 1,
    center = { x: 610, y: 360 },
    pointers = new Map<number, Point>(),
    dragged = false,
    gesture: Gesture | null = null;
  function createMap() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    activeMap = getMap(g);
    ({
      territories: TERRITORIES,
      byId: BY_ID,
      continents: CONTINENTS,
      seaLinks: SEA_LINKS,
    } = activeMap);
    $('#map-canvas').dataset.map = activeMap.id;
    $('.map-panel').setAttribute('aria-label', activeMap.name);
    $('.map-panel h1').textContent = `Borderfall – ${activeMap.name}`;
    $('#world-map').setAttribute(
      'aria-label',
      `${TERRITORIES.length} Gebiete. Wähle ein Gebiet, um deinen Zug auszuführen.`,
    );
    $('#continent-bonuses').setAttribute(
      'aria-label',
      'Truppenboni bei vollständiger Kontrolle einer Region',
    );
    const sea = SEA_LINKS.map(([a, b]) => {
      const f = BY_ID[a],
        t = BY_ID[b];
      return `<path class="sea-link" d="M${f.x},${f.y} Q${(f.x + t.x) / 2 - 10},${(f.y + t.y) / 2 - 22} ${t.x},${t.y}"/>`;
    }).join('');
    $('#world-map').innerHTML =
      `<defs><filter id="selected-shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#385e43" flood-opacity=".23"/></filter></defs>
    <g aria-hidden="true">${activeMap.oceans.map((o) => `<text class="ocean-label" x="${o.x}" y="${o.y}" ${o.rotate ? `transform="rotate(${o.rotate} ${o.x} ${o.y})"` : ''}>${o.text}</text>`).join('')}${sea}${activeMap.wrap ? '<path class="sea-link" d="M60 135 Q0 100 5 70 H1188 Q1210 100 1156 139"/>' : ''}</g>
    <g id="territories">${TERRITORIES.map((t) => `<g class="territory" data-id="${t.id}" role="button" tabindex="0" aria-label="${escape(t.name)}"><polygon class="land" points="${t.points}"/><rect class="army-pill" x="${t.x - 15}" y="${t.y - 12}" width="30" height="24" rx="8"/><text class="army-number" x="${t.x}" y="${t.y}">1</text></g>`).join('')}</g>`;
    $('#continent-bonuses').innerHTML = CONTINENTS.map(
      (c) =>
        `<div class="continent-bonus" data-continent="${c.id}"><span>${c!.name}</span><b>+${c.bonus}</b></div>`,
    ).join('');
  }

  function updateBonuses() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    for (const c of CONTINENTS) {
      const owners = new Set(
        TERRITORIES.filter((t) => t.continent === c.id).map((t) => g.board[t.id].owner),
      );
      const owner = owners.size === 1 ? g.players[[...owners][0]] : null;
      const badge = $(`[data-continent="${c.id}"]`);
      badge.classList.toggle('controlled', !!owner);
      badge.style.setProperty('--bonus-color', owner?.color ?? '#c4d3c0');
      badge.setAttribute(
        'aria-label',
        `${c!.name}: +${c.bonus} Truppen pro Zug bei vollständiger Kontrolle${owner ? `, kontrolliert von ${owner.name}` : ''}`,
      );
    }
    positionBonuses();
  }

  function armyRects() {
    return [...document.querySelectorAll('.army-pill')].map((el) => el.getBoundingClientRect());
  }
  function positionBonuses() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    positionToast();
    const canvas = $('#map-canvas'),
      map = $<SVGSVGElement>('#world-map'),
      matrix = map.getScreenCTM();
    if (!matrix) return;
    const bounds = canvas.getBoundingClientRect(),
      visibleHeight = Math.min(bounds.height, map.getBoundingClientRect().height);
    const stats = $('#scoreboard-widget').classList.contains('collapsed')
      ? null
      : $('#scoreboard-widget').getBoundingClientRect();
    const occupied: { left: number; right: number; top: number; bottom: number }[] =
      activeMap.id === 'europe'
        ? [...armyRects(), ...(stats ? [stats] : []), $('#map-hint').getBoundingClientRect()]
        : [];
    for (const c of CONTINENTS) {
      const badge = $(`[data-continent="${c.id}"]`);
      if (!badge) continue;
      const anchor = activeMap.bonuses[c.id],
        point = new DOMPoint(anchor.x, anchor.y).matrixTransform(matrix);
      let x = point.x - bounds.left,
        y = point.y - bounds.top;
      badge.hidden = x < 0 || x > bounds.width || y < 0 || y > visibleHeight;
      if (badge.hidden) continue;
      const half = badge.offsetWidth / 2;
      if (
        stats &&
        point.y + badge.offsetHeight / 2 > stats.top &&
        point.y - badge.offsetHeight / 2 < stats.bottom &&
        point.x - half < stats.right &&
        point.x + half > stats.left
      )
        x = stats.right - bounds.left + half + 8;
      x = Math.max(half + 5, Math.min(bounds.width - half - 5, x));
      y = Math.max(14, Math.min(visibleHeight - 14, y));
      if (activeMap.id === 'europe') {
        const halfHeight = badge.offsetHeight / 2,
          boxAt = (cx: number, cy: number) => ({
            left: bounds.left + cx - half - 3,
            right: bounds.left + cx + half + 3,
            top: bounds.top + cy - halfHeight - 3,
            bottom: bounds.top + cy + halfHeight + 3,
          });
        const offsets = [
          [0, 0],
          [0, -28],
          [0, 28],
          [-40, 0],
          [40, 0],
          [0, -56],
          [0, 56],
          [-40, -28],
          [40, -28],
          [-40, 28],
          [40, 28],
          [-80, 0],
          [80, 0],
          [0, -84],
          [0, 84],
          [-80, -28],
          [80, -28],
          [-80, 28],
          [80, 28],
        ];
        for (const [dx, dy] of offsets) {
          const cx = Math.max(half + 5, Math.min(bounds.width - half - 5, x + dx)),
            cy = Math.max(14, Math.min(visibleHeight - 14, y + dy)),
            box = boxAt(cx, cy);
          if (
            !occupied.some(
              (r) =>
                box.left < r.right &&
                box.right > r.left &&
                box.top < r.bottom &&
                box.bottom > r.top,
            )
          ) {
            x = cx;
            y = cy;
            break;
          }
        }
        occupied.push(boxAt(x, y));
      }
      badge.style.left = `${x}px`;
      badge.style.top = `${y}px`;
    }
  }

  function updateMap() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    const move =
      g.turn === 0 && selected && target ? fortifyPreview(g, selected, target, quantity) : null;
    for (const t of TERRITORIES) {
      const el = $(`[data-id="${t.id}"]`),
        b = g.board[t.id],
        p = g.players[b.owner];
      el.style.setProperty('--land', p.light);
      el.style.setProperty('--hover', p.color);
      el.style.setProperty('--color', p.color);
      el.classList.toggle('selected', selected === t.id);
      el.classList.toggle('target', target === t.id);
      const reachable =
        started &&
        g.turn === 0 &&
        selected &&
        ((g.phase === 'attack' && canAttack(g, selected, t.id)) ||
          (g.phase === 'fortify' && !g.fortified && connected(g, selected, t.id)));
      let armies = b.armies,
        preview = false;
      if (move && t.id === selected) {
        armies = move.fromArmies;
        preview = true;
      }
      if (move && t.id === target) {
        armies = move.toArmies;
        preview = true;
      }
      if (g.turn === 0 && g.pending && t.id === g.pending.from) {
        armies -= quantity;
        preview = true;
      }
      if (g.turn === 0 && g.pending && t.id === g.pending.to) {
        armies += quantity;
        preview = true;
      }
      el.classList.toggle('reachable', !!reachable);
      el.classList.toggle('move-preview', preview);
      el.querySelector('.army-number')!.textContent = String(armies);
      el.setAttribute(
        'aria-label',
        `${t.name}, ${p.name}, ${armies} Truppen${preview ? ', Vorschau' : ''}${reachable ? ', mögliches Ziel' : ''}`,
      );
      el.setAttribute('aria-pressed', String(t.id === selected || t.id === target));
    }
  }
  function renderScoreboard() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    $('#scoreboard').innerHTML = g.players
      .map(
        (p) =>
          `<div class="player-card ${g.turn === p.id ? 'active' : ''} ${p.alive ? '' : 'eliminated'}" style="--player:${p.color};--player-light:${p.light}"><button class="player-avatar" data-action="stats" aria-controls="scoreboard" aria-expanded="false" aria-label="${escape(p.name)}, ${territoriesOf(g, p.id).length} Gebiete, ${armiesOf(g, p.id)} Truppen${g.turn === p.id ? ', am Zug' : ''}. Spielerübersicht einblenden" title="Spielerübersicht einblenden" data-player="${p.id}">${p.symbol}</button><div class="player-details"><div class="player-identity"><div class="player-name" title="${escape(p.name)}"><span class="player-name-text">${escape(p.name)}</span>${g.turn === p.id ? '<i class="active-dot"></i>' : ''}</div><div class="player-detail">${p.alive ? (p.id === 0 ? 'Kommandant' : 'Computer') : 'Besiegt'}</div></div><div class="player-metrics"><div class="metric"><strong>${territoriesOf(g, p.id).length}</strong><span>Gebiete</span></div><div class="metric"><strong>${armiesOf(g, p.id)}</strong><span>Truppen</span></div></div></div></div>`,
      )
      .join('');
    updateScoreboardVisibility();
  }
  function updateScoreboardVisibility() {
    const { g, started, selected, target, quantity, statsPreference, modal } = getState();
    const collapsed = statsPreference ?? true;
    const widget = $('#scoreboard-widget');
    widget.classList.toggle('collapsed', collapsed);
    for (const button of widget.querySelectorAll<HTMLButtonElement>('.player-avatar')) {
      const player = g.players[Number(button.dataset.player)];
      const label = collapsed ? 'Spielerübersicht einblenden' : 'Spielerübersicht ausblenden';
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute(
        'aria-label',
        `${player.name}, ${territoriesOf(g, player.id).length} Gebiete, ${armiesOf(g, player.id)} Truppen${g.turn === player.id ? ', am Zug' : ''}. ${label}`,
      );
      button.title = label;
    }
    for (const details of widget.querySelectorAll<HTMLElement>('.player-details')) {
      details.inert = collapsed;
      details.setAttribute('aria-hidden', String(collapsed));
    }
  }
  function viewBox() {
    return { x: center.x - 610 / zoom, y: center.y - 360 / zoom, w: 1220 / zoom, h: 720 / zoom };
  }
  function updateZoom() {
    center.x = Math.max(-100, Math.min(1320, center.x));
    center.y = Math.max(-60, Math.min(780, center.y));
    const v = viewBox();
    $('#world-map').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    $('#zoom-reset').hidden =
      Math.abs(zoom - 1) < 0.001 &&
      Math.abs(center.x - 610) < 0.01 &&
      Math.abs(center.y - 360) < 0.01;
    positionBonuses();
  }
  function resetZoom() {
    zoom = 1;
    center = { x: 610, y: 360 };
    updateZoom();
  }
  function zoomBy(factor: number, point?: Point) {
    const before = point ? screenToMap(point.x, point.y) : null;
    zoom = Math.max(1, Math.min(4, zoom * factor));
    if (zoom === 1) center = { x: 610, y: 360 };
    updateZoom();
    if (point && zoom > 1) {
      const after = screenToMap(point.x, point.y);
      center.x += before!.x - after.x;
      center.y += before!.y - after.y;
      updateZoom();
    }
  }
  function screenToMap(x: number, y: number) {
    const svg = $<SVGSVGElement>('#world-map');
    const pt = new DOMPoint(x, y);
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  }
  $('#zoom-reset').addEventListener('click', resetZoom);
  const svg = $<SVGSVGElement>('#world-map');
  svg.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, { x: event.clientX, y: event.clientY });
    },
    { passive: false },
  );
  svg.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);
    $('#map-tooltip').hidden = true;
    if (pointers.size === 1) {
      dragged = false;
      gesture = {
        type: 'pan',
        point: screenToMap(event.clientX, event.clientY),
        start: { x: event.clientX, y: event.clientY },
        center: { ...center },
        id: event.target.closest<SVGElement>('[data-id]')?.dataset.id,
      };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      dragged = true;
      gesture = {
        type: 'pinch',
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  });
  svg.addEventListener('pointermove', (event) => {
    const { g } = getState();
    if (!(event.target instanceof Element)) return;
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture?.type === 'pinch' && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        zoomBy((gesture.zoom * distance) / gesture.distance / zoom, {
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        });
        return;
      }
      if (gesture?.type === 'pan') {
        if (Math.hypot(event.clientX - gesture.start.x, event.clientY - gesture.start.y) > 5) {
          dragged = true;
          svg.classList.add('dragging');
        }
        if (dragged) {
          const point = screenToMap(event.clientX, event.clientY);
          center.x += gesture.point.x - point.x;
          center.y += gesture.point.y - point.y;
          updateZoom();
        }
      }
    } else if (event.pointerType === 'mouse') {
      const el = event.target.closest<SVGElement>('[data-id]');
      if (!el) {
        $('#map-tooltip').hidden = true;
        return;
      }
      const t = BY_ID[el.dataset.id!],
        b = g.board[t.id],
        c = CONTINENTS.find((c) => c.id === t.continent),
        rect = $('#map-canvas').getBoundingClientRect();
      const tip = $('#map-tooltip');
      tip.innerHTML = `${t.name}<small>${escape(g.players[b.owner].name)} · ${b.armies} Truppen · ${c!.name}</small>`;
      tip.hidden = false;
      tip.style.left = `${Math.max(4, Math.min(rect.width - tip.offsetWidth - 4, event.clientX - rect.left + 12))}px`;
      tip.style.top = `${Math.max(4, Math.min(rect.height - tip.offsetHeight - 4, event.clientY - rect.top + 16))}px`;
    }
  });
  function releasePointer(event: PointerEvent) {
    const choose = !dragged && gesture?.type === 'pan' ? gesture.id : null;
    pointers.delete(event.pointerId);
    svg.classList.remove('dragging');
    if (event.type === 'pointerup' && choose) selectTerritory(choose);
    if (pointers.size === 1) {
      const [p] = pointers.values();
      gesture = {
        type: 'pan',
        point: screenToMap(p.x, p.y),
        start: p,
        center: { ...center },
        id: null,
      };
      dragged = true;
    } else if (!pointers.size) {
      gesture = null;
    }
  }
  svg.addEventListener('pointerup', releasePointer);
  svg.addEventListener('pointercancel', releasePointer);
  svg.addEventListener('pointerleave', () => {
    $('#map-tooltip').hidden = true;
  });
  svg.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element)) return;
    const el = event.target.closest<SVGElement>('[data-id]');
    if (!el) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectTerritory(el.dataset.id!);
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const t = BY_ID[el.dataset.id!],
        horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key),
        sign = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const next = TERRITORIES.filter((n) =>
        horizontal ? (n.x - t.x) * sign > 0 : (n.y - t.y) * sign > 0,
      ).sort((a, b) => {
        const score = (n: Territory) =>
          Math.hypot(n.x - t.x, n.y - t.y) +
          (horizontal ? Math.abs(n.y - t.y) : Math.abs(n.x - t.x)) * 2;
        return score(a) - score(b);
      })[0];
      if (next) {
        $(`[data-id="${next.id}"]`).focus();
        if (zoom > 1) {
          center = { x: next.x, y: next.y };
          updateZoom();
        }
      }
    }
  });

  return {
    createMap,
    updateMap,
    updateBonuses,
    positionBonuses,
    renderScoreboard,
    updateScoreboardVisibility,
    resetZoom,
    updateZoom,
    zoomBy,
  };
}
