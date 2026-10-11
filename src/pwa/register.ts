import { registerSW } from 'virtual:pwa-register';

interface Application {
  save(): Promise<void>;
  canUpdate(): boolean;
}

export function registerUpdates(application: Application) {
  const notice = document.createElement('aside');
  notice.className = 'update-notice';
  notice.hidden = true;
  notice.setAttribute('aria-label', 'Spielaktualisierung');
  notice.innerHTML =
    '<span role="status">Neue Version verfügbar.</span><button type="button">Aktualisieren</button><button type="button" aria-label="Aktualisierung später durchführen">Später</button>';
  document.body.append(notice);
  const buttons = notice.querySelectorAll('button');
  const status = notice.querySelector('span')!;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      notice.hidden = false;
    },
    onOfflineReady: () => {
      const ready = document.createElement('p');
      ready.className = 'offline-notice';
      ready.setAttribute('role', 'status');
      ready.textContent = 'Borderfall ist jetzt auch offline spielbar.';
      document.body.append(ready);
      setTimeout(() => ready.remove(), 6000);
    },
    onRegisterError: (error) => console.warn('Offline registration unavailable', error),
  });
  buttons[1].addEventListener('click', () => {
    notice.hidden = true;
  });
  buttons[0].addEventListener('click', async () => {
    if (!application.canUpdate()) {
      status.textContent = 'Beende zuerst den laufenden Kampf.';
      return;
    }
    buttons[0].disabled = true;
    try {
      await application.save();
      await updateSW(true);
    } catch {
      status.textContent = 'Aktualisierung fehlgeschlagen. Versuche es erneut.';
      buttons[0].disabled = false;
    }
  });
}
