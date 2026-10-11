import type { Lifecycle } from './lifecycle';

/** Only visible time counts, so returning to the game never skips a battle animation. */
export function waitWhileActive(
  lifecycle: Lifecycle,
  milliseconds: number,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    let remaining = milliseconds;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const finish = (completed: boolean) => {
      clearTimeout(timer);
      unsubscribe();
      signal.removeEventListener('abort', cancel);
      resolve(completed);
    };
    const cancel = () => finish(false);
    const change = (active: boolean) => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        remaining = Math.max(0, remaining - (performance.now() - started));
      }
      if (active) {
        started = performance.now();
        timer = setTimeout(() => finish(true), remaining);
      }
    };
    signal.addEventListener('abort', cancel, { once: true });
    unsubscribe = lifecycle.subscribe(change);
    change(lifecycle.isActive());
  });
}
