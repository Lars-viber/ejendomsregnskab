# Bogføring af ejendomsregnskaber

Webapplikation til træning i bogføring af ejendomsregnskaber på T-konti. Den studerende bogfører
20 bilag for et ejendomsselskab bilag for bilag med kontrol efter hvert bilag, opgør saldiene og
kan til sidst hente opgaven med facit i Excel.

Applikationen er en statisk side på GitHub Pages: der kræves ingen server, download eller installation.
Fremskridtet gemmes i den studerendes egen browser.

## Offentliggørelse

Når koden sendes til grenen `main`, bygger GitHub applikationen automatisk og lægger den på GitHub Pages
(`.github/workflows/deploy.yml`). Inden offentliggørelsen køres alle automatiske tests, og den byggede
udgave kontrolleres for testknapper og testkode (`pnpm kontroller-offentlig`).

## Lokal udvikling

Kræver Node.js 24 og pnpm (versionen står i `package.json`).

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

| Kommando | Formål |
|---|---|
| `pnpm test` | Alle automatiske tests |
| `pnpm build` | Bygger den offentlige udgave i `dist/` |
| `pnpm preview` | Viser den byggede udgave lokalt |
| `pnpm kontroller-offentlig` | Kontrollerer, at `dist/` ikke indeholder testkode |
| `pnpm gennemloeb` | Kører alle 3 × 999.999 variantnumre gennem generatoren og regelkontrollen |

I den lokale udviklingsudgave (`pnpm dev`) findes to midlertidige testknapper, der springer frem til
saldiopgørelsen. De er aldrig med i den byggede udgave.
