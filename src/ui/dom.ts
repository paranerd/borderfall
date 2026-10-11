export function $<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}
export const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      (
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
          string,
          string
        >
      )[c],
  );
const icons: Record<string, string> = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 1 1 3.7 2.2c-1.2.6-1.2 1.8-1.2 2.8m0 3h.01"/>',
  book: '<path d="M12 5v16m0-16C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  sound: '<path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  attack: '<path d="m4 20 6-6m-5-4 9 9m-6-7L18 2l4 4-10 10M2 18l4 4"/>',
  blitz: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  move: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  cards:
    '<rect x="7" y="4" width="13" height="17" rx="2"/><path d="M4 17H3V2h13v1m-3 5 3 4-3 4-3-4 3-4Z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  infantry:
    '<circle cx="12" cy="5" r="2"/><path d="M8 9h8m-4-2v8m0-1-4 7m4-7 4 7M8 9l-3 6m11-6 3 6"/>',
  cavalry: '<path d="m5 21 2-6-3-5 6-6 2 3 5-2 3 6-3 4v6H5Zm5-14 1 4M8 17h9"/>',
  artillery: '<circle cx="8" cy="17" r="4"/><path d="m8 13 10-9 3 3-10 9m1 1h8l1 4M4 21h12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  flag: '<path d="M5 21V3m0 1h14l-3 4 3 4H5"/>',
};
export const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.globe}</svg>`;

export const difficultyName = (d: string) =>
  (({ easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' }) as Record<string, string>)[d] ?? 'Mittel';
