# Doppelpendel

Chaotisches Doppelpendel mit Canvas, ereignisgesteuertem Klang (Tone.js) und Audio-Aufnahme.

**Projektordner:** `/Users/nilspocklitz/Desktop/Cursor Projekte/Pendel`

**Live:** https://nknj5fbrsm-del.github.io/Pendel/

## Lokal starten (Vorschau)

```bash
cd "/Users/nilspocklitz/Desktop/Cursor Projekte/Pendel"
npm install
npm start
```

Dann im Browser öffnen: **http://localhost:5180**

`npm start` baut TypeScript und startet den lokalen Server auf Port **5180** (nicht 5173 — der ist von SongMash belegt). Zum Beenden im Terminal **Ctrl+C**.

### Einzelne Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run build` | TypeScript → `dist/main.js` |
| `npm run dev` | Nur HTTP-Server auf Port 5180 |
| `npm start` | Build + Server (empfohlen) |

**Hinweis:** Die Seite per HTTP öffnen, nicht per Doppelklick auf `index.html` (`file://` funktioniert nicht zuverlässig).

## Struktur

```
index.html      UI + CSS
src/main.ts     Simulation, Audio, Renderer, Aufnahme
dist/main.js    Build-Ausgabe (für GitHub Pages mit committen)
```

## Deploy (GitHub Pages)

```bash
cd "/Users/nilspocklitz/Desktop/Cursor Projekte/Pendel"
npm run build
git add .
git commit -m "Beschreibung der Änderung"
git push
```

Nach dem Push aktualisiert sich die GitHub-Pages-URL automatisch.

## Nachbau-Spezifikation

Siehe `REBUILD_PROMPT.md` für eine vollständige Beschreibung des aktuellen Stands.
