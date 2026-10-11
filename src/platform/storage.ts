export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** A native implementation can later use Capacitor Preferences with the same contract. */
export class BrowserStorage implements KeyValueStorage {
  constructor(private readonly storage: () => Storage = () => window.localStorage) {}
  async get(key: string): Promise<string | null> {
    return this.storage().getItem(key);
  }
  async set(key: string, value: string): Promise<void> {
    this.storage().setItem(key, value);
  }
}

/** Capture values at enqueue time; failed writes must not block later saves. */
export class OrderedStorage implements KeyValueStorage {
  private queue: Promise<void> = Promise.resolve();
  private lastWrite: Promise<void> = this.queue;
  constructor(private readonly storage: KeyValueStorage) {}
  async get(key: string): Promise<string | null> {
    await this.queue;
    return this.storage.get(key);
  }
  set(key: string, value: string): Promise<void> {
    const write = this.queue.then(() => this.storage.set(key, value));
    this.queue = write.catch(() => undefined);
    this.lastWrite = write;
    return write;
  }
  flush(): Promise<void> {
    return this.lastWrite;
  }
}
