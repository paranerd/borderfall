import { MAPS } from '../game/maps';
import { icon } from './dom';
import type { Setup } from '../application/types';
export function modalWrapper(content: string, label: string, closable = true, extraClass = '') {
  return `<section class="modal ${extraClass}" role="dialog" aria-modal="true" aria-label="${label}" tabindex="-1">${closable ? `<button class="modal-close" data-modal="close" aria-label="Schließen">${icon('close')}</button>` : ''}${content}</section>`;
}
export function mapSelectionMarkup(setup: Setup) {
  return `<div class="map-selection"><span class="field-label">KARTE</span><div class="map-choices" role="group" aria-label="Karte auswählen">${Object.values(
    MAPS,
  )
    .map(
      (map) =>
        `<button class="map-choice ${setup.mapId === map.id ? 'chosen' : ''}" data-map="${map.id}" aria-pressed="${setup.mapId === map.id}" aria-label="${map.name}, ${map.territories.length} Gebiete"><svg viewBox="0 0 1220 720" aria-hidden="true">${map.territories.map((t) => `<polygon points="${t.points}" fill="${map.continents.find((c) => c.id === t.continent)!.color}" stroke="#edf1e6" stroke-width="6"/>`).join('')}</svg><span class="map-choice-info"><strong>${map.name}</strong><small>${map.territories.length} Gebiete<span class="map-region-count"> · ${map.continents.length} Regionen</span></small><span>${map.description}</span></span></button>`,
    )
    .join('')}</div></div>`;
}
