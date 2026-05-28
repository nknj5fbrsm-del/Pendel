# Doppelpendel-Web-App — Nachbau-Prompt

Baue eine statische Web-App auf Deutsch für ein chaotisches **Doppelpendel** mit Canvas, ereignisgesteuertem Klang (Tone.js) und Audio-Aufnahme.

**Stack:** `index.html` (Markup + CSS), `src/main.ts` → `tsc` → `dist/main.js`, Tone.js **14.8.49** per CDN (`https://unpkg.com/tone@14.8.49/build/Tone.js`), `declare const Tone: any` in TS. Lokal: `npm run build`, `python3 -m http.server 5173`, Seite per HTTP öffnen.

**Dateien:** `package.json` (nur `typescript` als devDependency, Scripts `build`/`dev`), `tsconfig.json` (ES2020, strict, `outDir: dist`, `rootDir: src`).

---

## Layout & UI

- **Grid:** Sidebar links `minmax(240px, 300px)`, rechts Hauptbereich; `align-items: stretch`.
- **Sidebar:** Titel „Doppelpendel“, Kurztext (Lagrange, Chaos), fünf Blöcke mit exakt diesem Inhalt:
  - **Bild:** weiße Referenzlinie, rosa Regenbogen-Spur; Legende „Helle Melodie“ (blau) / „Warme Melodie“ (rosa).
  - **Winkelmaß:** Pendel bleibt beim Scrollen sichtbar; Kreis mit Strichen alle 15°, Zahlen alle 30°; auf größter Bahn der rosa Masse; 0° unten, 90° rechts (Referenzlinie), 180° oben, 270° links; θ₁ am blauen Arm, θ₂ an rosa Masse.
  - **Click (nur blau):** zusätzlich zur Melodie, wenn Linienschnitt und ω₁-Richtungswechsel innerhalb ca. 0,25 s zusammenfallen.
  - **Klang:** beim Linienübertritt Pentatonik mit variabler Höhe, Lautstärke, Dauer; blau hell, rosa warm.
  - **Aufnahme:** Button „Aufnahme“ / „Aufnahme ●“, Download .webm und .wav unter dem Pendel.
- **Toolbar (sticky, `top: 0`):** `Start` | `Pause`/`Weiter` | `Stop` | `Aufnahme` | `#status`.
- **Stage (sticky, `top: var(--toolbar-sticky-height)`):** Desktop `4.25rem`, ≤860px `6.75rem`; rundes Canvas in `.canvas-wrap`.
- **Design:** Dark-Mystik — Fonts Cinzel + Outfit; CSS-Variablen u. a. `--void #06040c`, `--text #e8e0f8`, `--muted #9b8fb8`, `--blue #7eb8ff`, `--pink #ff7eb8`; radiale Body-Gradients; runde Pill-Buttons; Aufnahme-Block mit pinkem Akzent (`block-record`).
- **Canvas:** `min(calc(100vw - 320px), 560px)`, Mobile `min(92vw, 480px)`, `aspect-ratio: 1`, runder Gradient-Rand, radialer Canvas-Hintergrund `#120c1e` → `#06040c`.

### Button-Logik

- **Start:** `Tone.start()`, lazy `AudioEngine` + `RecorderController`; Simulation läuft; Start disabled, Pause/Stop/Record enabled; Status „Simulation aktiv“. Beim erneuten Start nach Stop: Zustand zurücksetzen.
- **Pause/Weiter:** Toggle `paused`, Text wechselt; Trail aus; Status „Pausiert“ / „Simulation aktiv“.
- **Stop:** Simulation stoppen, Zustand & Visuals & Audio-Trigger zurücksetzen, laufende Aufnahme beenden, UI wie initial (nur Start aktiv), Status „Gestoppt“, Stillstand-Darstellung.
- **Aufnahme:** Toggle Recording, Text „Aufnahme“ / „Aufnahme ●“, Klasse `active` beim Aufnehmen.

---

## Physik

**Zustand:** `theta1`, `theta2`, `omega1`, `omega2`.

**Parameter:** `m1=1`, `m2=1`, `l1=1`, `l2=1`, `g=9.81`.

**Koordinaten:** `x = l·sin(θ)`, `y = l·cos(θ)` (0° = senkrecht nach unten).

**Start:** `theta1 = 0.95π`, `theta2 = 0.95π + 0.01`, `omega1 = omega2 = 0`.

**Integration:** Lagrange-Gleichungen (Standard-Doppelpendel mit `delta = θ2 − θ1`) als ODE; Zeitschritt **RK4** in `step(dt)`.

**Loop:** `requestAnimationFrame`; pro Frame `dt = min(dtRaw, 0.03)`, **3 Substeps**; nach jedem Substep Ereignisse prüfen und Audio auslösen.

**Stillstand (Pulsieren):** wenn nicht `running` oder `paused`, oder `|ω1| + |ω2| < 0.08`.

---

## Ereignisse & Klang

Pro Substep aus vorherigem und neuem Zustand/Geometrie:

| Signal | Erkennung |
|--------|-----------|
| Linienschnitt bob1/bob2 | `prevY * nextY < 0` (y der Masse kreuzt Referenz y=0) |
| ω₁-/ω₂-Flip | `prevOmega * nextOmega < 0` |

### Audio (`AudioEngine`)

- **Blaue Masse:** bei `bob1Cross` → `MelodyGenerator("bright")`, Cooldown **0,1 s**.
- **Blaue Masse zusätzlich:** wenn Linienschnitt- und ω₁-Flip-Zeitstempel beide gesetzt und innerhalb **0,25 s** (`pairWindow`) → `MembraneSynth` `C6`, Dauer `0.015`, Velocity `0.22`, Click-Cooldown **0,04 s**; danach beide Timestamps auf −1.
- **Rosa Masse:** bei `bob2Cross` → `MelodyGenerator("warm")`, Cooldown **0,1 s**.

### MelodyGenerator

`Tone.FMSynth` → Filter → `Gain(0.7)` → Destination; Skalenindex wandert zufällig ±2 (geclampt, nie gleicher Index); `velocity` 0,3–0,5; `duration` 0,16–0,4 s.

- **bright:** Skala `E4 G4 B4 D5 E5 G5 B5 D6`, Startindex 3, Highpass 180 Hz, kurze FM-Envelopes (triangle/sine).
- **warm:** Skala `D3 E3 G3 A3 B3 D4 E4 G4 A4`, Startindex 4, Lowpass 2200 Hz, längere FM-Envelopes (sine/triangle).

Bei Note: kurzer visueller Flash an der Masse (`applySoundFlash`).

---

## Aufnahme

`MediaStreamAudioDestinationNode` an `Tone.Destination`; `MediaRecorder` (bevorzugt webm/opus); Chunks → Blob; Download-Link **pendel-audio.webm**; optional WAV via `decodeAudioData` + PCM-WAV-Encoder; Links in `#downloads`; Status deutsch („Aufnahme laeuft“, „wird verarbeitet“, „bereit“).

---

## Zeichnung (`Renderer`)

- **Skalierung:** `scale = (min(w,h)/2 - 24) / (l1+l2) * 0.9`; Aufhängung Canvas-Mitte.
- **Winkelkreis:** Radius `(l1+l2)*scale + trailWidth/2 + 0.5`; Striche 15°, Labels 30° mit `Outfit` 9px.
- **Referenz:** horizontale Linie durch Aufhängung.
- **Spur:** nur **rosa Masse** — bis 700 Punkte, Regenbogen-`hsla`, `trailWidth 0.5`, Fade `life *= 0.994`; leichter Vollbild-Fade `rgba(6,4,12,0.14)` pro Frame.
- **Arme:** 0,65 px, bob1 bläulich, bob2 rötlich; leichter Arm-Schatten.
- **Massen:** bob1 r=3,5 `#9ec8ff`, bob2 r=4,5 `#ff8ec4`; Pivot r=1,5; bei Stillstand Puls + Atemring; bei Klang Farbmix zum hellen Ton.
- Trail nur wenn `running && !paused`.

---

## Klassenstruktur in `main.ts`

`DoublePendulumSimulation`, `MelodyGenerator`, `AudioEngine`, `RecorderController`, `Renderer`, Hilfsfunktionen (`getPendulumGeometry`, `didCrossLine`, `didOmegaFlip`, RK4-Helfer, WAV-Export), `bootstrap()` mit DOM-IDs wie in `index.html`.

Script-Einbindung: `<script type="module" src="./dist/main.js">`.

---

*Stand: entspricht dem aktuellen Projekt in diesem Repository.*
