import { BrowserStorage, OrderedStorage } from './storage';
import { BrowserLifecycle } from './lifecycle';
import { BrowserAudio } from './audio';
import type { Lifecycle } from './lifecycle';
import type { GameAudio } from './audio';
export interface Platform {
  storage: OrderedStorage;
  lifecycle: Lifecycle;
  audio: GameAudio;
}
export function createBrowserPlatform(): Platform {
  return {
    storage: new OrderedStorage(new BrowserStorage()),
    lifecycle: new BrowserLifecycle(),
    audio: new BrowserAudio(),
  };
}
