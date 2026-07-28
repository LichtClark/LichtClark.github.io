# clarkie.de — vereinheitlichte Version

Alle Seiten von [clarkie.de](https://clarkie.de/) in **einem** Design.
Vorlage ist das Terminal-/Monospace-Design von `ExpenseSplitter-Cloud`
(→ [split.clarkie.de](https://split.clarkie.de/)).

Die Startseite behält ihre Idee: Partikel-Canvas, anklickbarer Titel,
Menü. Alles andere wurde auf ein gemeinsames System umgestellt.

## Was sich geändert hat

| Vorher | Jetzt |
|---|---|
| Jede Seite mit eigenem `<style>`-Block (roter Kasten, graues Menü, gelbe Rechtsseite) | Eine Datei `assets/style.css` für alles |
| Kein gemeinsamer Kopf, keine Navigation zwischen Unterseiten | Masthead + Tab-Navigation auf jeder Seite, unten fixiert auf dem Handy |
| Startseite: Menü nur über Titelklick erreichbar | Menü in der Mitte (startet eingeklappt) **plus** dauerhaft erreichbare Seitenleiste über den Burger oben links |
| Datenschutz-Overlay nur auf der Startseite | Einheitliches Modal, zentral in `assets/site.js`, greift von jeder Seite aus |
| System-Info als ASCII-Strichlinien-Wüste | Nach Themen gruppierte Karten mit deutschen Beschriftungen |
| YouTube-Video lud sofort mit Autoplay | Klick-zum-Laden über `youtube-nocookie.com` |
| Ungenutztes CDN-Skript (UAParser von cdnjs) | Entfernt — keine externen Skripte mehr |
| Kein Light-Mode | Hell/Dunkel automatisch über `prefers-color-scheme` |
| `split.clarkie.de` nirgends erwähnt | Eigener Eintrag in Menü und Seitenleiste, dazu in jeder Fußzeile |

## System-Info: was inhaltlich dazugekommen ist

* **Externe IP unverändert** — weiterhin das Ergebnis der Cloudflare-Abfrage aus `index.js`.
  Zusätzlich zwei neue Zeilen **IPv4** und **IPv6**, getrennt über `icanhazip.com` (Cloudflare).
* **Speicher unverändert** — die fünfzeilige Aufstellung („Storage Value (INT)“ bis
  „Approximately Estimated value“) steht Zeichen für Zeichen so da wie vorher, in einer
  eigenen Karte. Sie wird von der Label-Bereinigung bewusst ausgenommen.
* **Stadt korrigiert.** `ipapi.co` ordnete deutsche Kabelanschlüsse dem Providersitz zu
  (Berlin statt Heidelberg), `ipinfo.io` lag mit Leipzig ebenfalls daneben. Jetzt
  `get.geojs.io` — das trifft die Stadt korrekt und liefert zusätzlich die Region.
  Das ist die einzige inhaltliche Änderung an `webrtc/index.js`.
* **Neu: genauer Standort.** Kein IP-Dienst der Welt kann Straße und Hausnummer —
  IP-Geolocation endet bei Stadt/PLZ. Straßengenau geht nur über die Standortfreigabe
  des Browsers (GPS beziehungsweise WLAN-Ortung). Dafür gibt es jetzt einen Knopf:
  nach Klick und Freigabe werden die Koordinaten per `photon.komoot.io` (OpenStreetMap,
  ersatzweise Nominatim) in eine Adresse übersetzt — inklusive Hausnummer, Stadtteil
  und Postleitzahl. Ohne Klick und ohne Freigabe passiert nichts davon.

Die Label-Bereinigung entfernt nur exakt das in `data-strip` genannte englische Präfix
(`data-strip="Timezone"` macht aus „Timezone: Europe/Berlin“ ein „Europe/Berlin“).
Felder ohne `data-strip` — Speicher, externe IP, Uhrzeit, Datum, Grafikkarte,
Schleifendurchlauf — bleiben unangetastet.

## Struktur

```
index.html                    Startseite (Canvas + Menü + Seitenleiste)
assets/style.css              Design-System — die einzige Stildatei
assets/site.js                Consent-Modal, aktive Navigation, Jahreszahl
assets/bg.js                  Partikel-Hintergrund
csgo/                         Configs, Startparameter, Maus-Screenshots
filme/ · filme/thriller/      Filmempfehlungen mit Bewertung
setting/ · opsec/ · motivation/
webrtc/index.html             System-Info (Skript index.js unverändert)
webrtc/datenschutz.html       Datenschutzerklärung
```

## Design-Tokens

Identisch zu ExpenseSplitter-Cloud, definiert in `assets/style.css`:

```
--bg #000      --panel #0a0a0a   --border #2a2a2a
--text #d8d8d8 --bright #fff     --dim #888
--up #2fbb6e   --down #e23b3b    --neu #d6a43a
--mono 'Courier New'
```

Keine abgerundeten Ecken, 1px-Rahmen, Versalien mit Sperrung in Überschriften.

## Zwei Punkte zum Nachziehen

1. **Ordner umbenannt.** `CS:GO/` heißt jetzt `csgo/` — ein Doppelpunkt ist unter
   Windows kein gültiger Ordnername. Ebenso `Filme/` → `filme/` und `Setting/` → `setting/`,
   damit alle Pfade klein geschrieben sind. GitHub Pages unterscheidet Groß- und
   Kleinschreibung: alte Links wie `clarkie.de/Filme/` laufen danach ins Leere.
2. **`webrtc/Datenschutzerklärung.html` heißt jetzt `webrtc/datenschutz.html`** — Umlaut
   im Dateinamen raus.
3. **Datumsfehler in `webrtc/index.js` — bewusst nicht angefasst.** Das Skript baut das
   Datum mit `getMonth()` ohne das nötige `+ 1`, zeigt also durchgehend den Vormonat
   (heute 28.07. erscheint als 28.06.). Fehler steckt im Original; Fix wäre einzeilig,
   ändert aber die Ausgabe — Entscheidung liegt bei dir.

## Nicht übernommen

Aus dem Original-Repo blieben liegen, weil sie von keiner Seite verlinkt sind:
`Sites/` (eine ältere Kopie von `Filme/`, `Setting/`, `webrtc/`), `other/friends/`,
`xssjs/`, `test/`. Bei Bedarf einfach aus dem Repo dazukopieren.

## Lokal ansehen

```bash
python -m http.server 8000
```

Dann [http://localhost:8000](http://localhost:8000) öffnen. Über `file://` funktioniert
alles außer der IP-Abfrage auf der System-Info-Seite.
