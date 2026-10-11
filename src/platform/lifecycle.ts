export interface Lifecycle {
  isActive(): boolean;
  subscribe(listener: (active: boolean) => void): () => void;
}

export class BrowserLifecycle implements Lifecycle {
  isActive(): boolean {
    return !document.hidden;
  }
  subscribe(listener: (active: boolean) => void): () => void {
    const visibility = () => listener(this.isActive());
    const hide = () => listener(false);
    const show = () => listener(this.isActive());
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }
}
