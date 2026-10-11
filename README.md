# Borderfall

**Dein Zug. Deine Welt.** Ein rundenbasiertes Strategiespiel mit Weltkarte und Europa, bis zu drei Computergegnern und drei Schwierigkeitsgraden. Die Oberfläche und Spielregeln sind auf Deutsch.

[Spielen](https://paranerd.github.io/borderfall/)

## Entwicklung

Node.js 24 und pnpm 11 verwenden. Die pnpm-Version ist in `package.json` festgelegt.

```sh
pnpm install
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

Die Entwicklung läuft unter `http://127.0.0.1:5173/`. Der Produktionsbuild ist unter `http://127.0.0.1:4173/borderfall/` erreichbar. `pnpm format` formatiert die Quellen; `pnpm format:check` prüft sie.

## Aufbau

- `src/game`: typisierte Regeln, Computerstrategien, Kartendaten und Prüfung gespeicherter Partien; unabhängig vom Browser.
- `src/application`: Spielablauf, Dialogzustand und Laden/Speichern.
- `src/ui`: Kartenbedienung, Aktionen, Kampfdarstellung und Dialogbausteine.
- `src/platform`: Schnittstellen für asynchrone Speicherung, Audio und App-Lebenszyklus; derzeit Browser-Implementierungen.
- `src/styles`: SCSS-Module. Die Reihenfolge erhält das bestehende responsive Layout.
- `src/pwa`: Offline-Verfügbarkeit und vom Spieler ausgelöste Aktualisierungen.

Die Speicherung verarbeitet Schreibvorgänge der Reihe nach und erfasst jeden Spielstand beim Aufruf. Die bestehenden lokalen Schlüssel (`weltmacht.*`) bleiben kompatibel. Beschädigte Spielstände werden verworfen. Ein Wechsel der Browseradresse oder des Geräts beginnt eine unabhängige Partie; es gibt keinen globalen Fortschritt und keinen Import/Export.

Beim Wechsel in den Hintergrund pausieren Computerzüge, Kampftimer und Audio. Ein Würfelergebnis wird bereits vor seiner Animation gespeichert und beim Zurückkehren nicht erneut gewürfelt.

## PWA und GitHub Pages

Die Anwendung unterstützt aktuelle Browser auf Desktop, iOS und Android, einschließlich Hoch- und Querformat sowie Displayaussparungen. Nach dem ersten vollständigen Laden werden Spiel, Karten, Icons und Schriften lokal vorgehalten. Danach kann auch ohne Verbindung gespielt werden. Über die Installationsfunktion des Browsers beziehungsweise „Zum Home-Bildschirm“ lässt sich Borderfall als eigenständige Web-App öffnen.

Neue Versionen werden angekündigt und erst auf Wunsch aktiviert. Die Partie wird vor der Aktualisierung gespeichert; während eines laufenden Kampfdialogs wird nicht aktualisiert.

Der Workflow `.github/workflows/pages.yml` prüft Formatierung, Tests und Produktionsbuild. Änderungen auf `main` werden anschließend auf GitHub Pages veröffentlicht. Pull Requests werden geprüft, ohne veröffentlicht zu werden. Die Pages-Quelle muss in den Repository-Einstellungen auf **GitHub Actions** stehen. Vite und der Service Worker verwenden den Projektpfad `/borderfall/`.

## Spätere Mobile App

Diese Ausbaustufe enthält bewusst noch kein natives Projekt. Für eine spätere Capacitor-App kann derselbe Spielkern verwendet werden. Native Adapter können BrowserStorage, BrowserLifecycle und BrowserAudio ersetzen; die Spielregeln benötigen dafür keine Plattformabhängigkeiten. Beim Hinzufügen des nativen Projekts müssen der Build-Basispfad und die Service-Worker-Registrierung an die eingebettete Laufzeit angepasst werden. Signierung und Store-Veröffentlichung gehören zu dieser späteren Ausbaustufe.

## Tests

Die automatischen Tests prüfen Spielregeln und Karten, gespeicherte Partien, die Reihenfolge asynchroner Speicherung, Hintergrundpausen und die ursprüngliche Truppenstärke im Kampfdialog. `tests/ui-fixtures.html` stellt lokal gezielte Spielzustände zum manuellen Prüfen bereit und ist nicht Bestandteil des Produktionsbuilds. Die Zustände überschreiben ausschließlich die lokale Partie auf der Entwicklungsadresse.
