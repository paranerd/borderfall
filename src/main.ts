import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles/main.scss';
import { createBrowserPlatform } from './platform';
import { startApplication } from './application/controller';
import { registerUpdates } from './pwa/register';
import { lockInterfaceZoom } from './ui/viewport';

async function main() {
  lockInterfaceZoom();
  const application = await startApplication(createBrowserPlatform());
  registerUpdates(application);
}

void main().catch((error) => {
  console.error('Borderfall could not start', error);
  const notice = document.createElement('p');
  notice.className = 'startup-error';
  notice.setAttribute('role', 'alert');
  notice.textContent = 'Borderfall konnte nicht starten. Lade die Seite bitte erneut.';
  document.body.append(notice);
});
