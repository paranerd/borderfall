/** Keep browser zoom separate from the map's own pointer and wheel controls. */
export function lockInterfaceZoom() {
  const preventZoom = (event: Event) => event.preventDefault();
  const options = { capture: true, passive: false };

  // Safari exposes trackpad pinch gestures separately from wheel events.
  document.addEventListener('gesturestart', preventZoom, options);
  document.addEventListener('gesturechange', preventZoom, options);
  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    },
    options,
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key))
        event.preventDefault();
    },
    options,
  );
}
