export const HELP = [
  {
    tab: 'Spielziel',
    title: 'Erobere die ganze Karte.',
    text: 'Erobere alle Gebiete und besiege die Computergegner. Jeder Zug hat drei Phasen: Verstärken, Angreifen und Verschieben.',
    text2:
      'Wähle Gebiete direkt auf der Karte. Markierte Grenzen zeigen mögliche Ziele. Zoome mit dem Mausrad oder ziehe zwei Finger auseinander / zusammen. Auch + / − auf der Tastatur funktioniert. Ziehe die Karte zum Verschieben. Nach Zoomen oder Verschieben setzt der Button unten rechts die gesamte Kartenansicht zurück. Oben rechts steht immer ein Fragezeichen bereit; tippe darauf, um den aktuellen Spielhinweis aufzuklappen.',
    example: '<b>1 → 2 → 3</b> Verstärken · Angreifen · Verschieben',
  },
  {
    tab: 'Verstärken',
    title: 'Jede Runde wächst deine Armee.',
    text: 'Du erhältst ein Drittel deiner Gebietsanzahl, abgerundet, mindestens aber 3 Truppen. Vollständig kontrollierte Bonusregionen geben zusätzliche Verstärkung.',
    text2:
      'Wähle ein eigenes Gebiet und setze mit + einzelne Truppen. Mit − nimmst du hier gesetzte Truppen zurück. Ab 5 verfügbaren Truppen setzt Max den gesamten Vorrat. Die Zahl dazwischen zeigt den Vorrat. Wenn alles verteilt ist, wechselst du mit einem Klick auf den Phasenbutton zum Angriff.',
    example:
      '<b>+5</b> für Nordamerika oder Europa · Asien +7 · Afrika +3 · Südamerika / Australien +2',
  },
  {
    tab: 'Angreifen',
    title: 'Ein Würfelwurf kann alles ändern.',
    text: 'Angreifen öffnet den manuellen Kampf: Die Würfel rollen, werden sortiert und verglichen. Mit Nächste Runde kämpfst du weiter; Aufgeben beendet diesen Angriff, dein Zug geht weiter. Blitzangriff kämpft automatisch bis zur Eroberung oder bis eine eigene Truppe bleibt. Angrenzende Gegner sind mit mindestens 2 eigenen Truppen angreifbar.',
    text2:
      'Angreifer: bis zu 3 Würfel, Verteidiger: bis zu 2. Die höchsten Werte werden paarweise verglichen: Der niedrigere verliert eine Truppe, Gleichstand schützt den Verteidiger. Nach der Eroberung rücken Angriffstruppen vor; weitere kannst du nachziehen. Nach dem Nachziehen ist das eroberte Gebiet automatisch dein neuer Ausgangspunkt. Du kannst beliebig oft angreifen. Nach einem ausgeführten Angriff wechselst du mit einem Klick auf den Phasenbutton zum Verschieben. Ohne Angriff bestätigst du den Wechsel mit einem zweiten Klick.',
    example: '<b>6 : 4</b> Verteidiger verliert 1 · Bei 4 : 4 verliert der Angreifer 1',
  },
  {
    tab: 'Verschieben',
    title: 'Sichere deine nächste Runde.',
    text: 'Einmal pro Zug kannst du Truppen zwischen zwei eigenen Gebieten verschieben. Zwischen ihnen muss ein durchgängiger Weg durch eigene Gebiete bestehen.',
    text2:
      'Wähle das Ausgangsgebiet: Ein erneuter Klick darauf löst die Auswahl auf. Passe die Anzahl mit − / + an und wähle ein verbundenes Ziel. Die Karte zeigt die Truppenbewegung sofort als Vorschau; mit dem Haken führst du sie aus. Eine Truppe bleibt zurück. Solange du nichts verschoben hast, bestätigst du das Zugende im Button. Nach einer Verschiebung genügt ein Klick.',
    example: '<b>≥ 1</b> Truppe bleibt immer in jedem Gebiet zurück',
  },
  {
    tab: 'Karten',
    title: 'Erfolge bringen Verstärkung.',
    text: 'Wenn du in deinem Zug mindestens ein Gebiet eroberst, erhältst du am Zugende eine Gebietskarte. Drei gleiche Symbole oder je eines der drei Symbole bilden ein Set.',
    text2:
      'Tausche Sets in der Verstärkungsphase: 4, 6, 8, 10, 12, 15, danach jeweils 5 Truppen mehr. Bei 5 oder mehr Karten musst du tauschen. Eine passende eigene Gebietskarte bringt einmal +2 Truppen in dieses Gebiet.',
    example: '<b>3</b> Infanterie, Kavallerie oder Artillerie · oder je 1 davon',
  },
];
