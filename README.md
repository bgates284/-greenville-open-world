# Greenville Open World

Open-world Greenville, NC in Three.js: real OpenStreetMap streets and buildings, Pitt County parcels,
restaurants and stores, traffic, pedestrians, and a plane at Pitt-Greenville Airport.

## Play with live reloading

1. Install [Node.js](https://nodejs.org) (LTS) if you don't have it.
2. Double-click **`start-dev.cmd`**, or in a terminal:
   ```
   npm install
   npm run dev
   ```
3. The game opens at <http://localhost:5173>. Leave the terminal window open while you play.

Edit anything in `src/` and save — the running game picks it up. A small badge in the bottom-right
corner shows what happened ("updated 06b_plane.js", or the error and line if the code has a mistake;
the game keeps running on the old code until it's fixed).

| File(s) | What happens when you save |
|---|---|
| `05_env`, `06_player`, `06b_plane`, `07_traffic`, `07b_hospital`, `07c_hangout`, `08_ui`, `08b_cinematic`, `09_main`, `04e_overview` | New code swaps in instantly; you keep your position, speed and everything else |
| `03j_airport` | Swaps in, then the plane model and airport are rebuilt around you |
| `04_world`, `04b_food`, `04c_neighborhoods`, `04d_streets`, `04f_landmarks`, `03g_food`, `03h_retail`, `03i_parcels` | Swaps in, then the map squares around you are rebuilt with the new code |
| `01_core`, `02_render_textures`, `03_models`, `03c`–`03f` (people/avatars), `template.html` | The page reloads and puts you back where you were (walking, driving or flying) |

Pressing F5 also brings you back to where you were.

If Vite gives you trouble, `npm run dev:plain` runs the same live-reloading server with no dependencies.

### Map data
In development the dev server fetches the OpenStreetMap data for the game, retries across several
mirror servers when one is busy, and keeps a copy in `.cache/`, so each area is only downloaded once
(even across restarts). The terminal window shows what it's doing. To reuse what the Desktop version
already downloaded, use **Export map data** there and **Import** here.

## Build the double-clickable file

```
npm run build      → dist/Greenville Open World.html
npm run desktop    → same, and copies it to your Desktop
npm run check      → syntax-check all source files
```

## How the live reload works

The game's source is ~20 files that share one scope (the build joins them into one script). In
development each file loads as its own classic script (`tools/gv-dev.mjs` serves them, transformed
by `tools/gv-hot.mjs`); when one changes, `tools/gv-client.js` runs the new version on top of the
running game: objects like `Player` or `Plane` get the new methods but keep their live state, edited
constants and data tables take their new values, and one-time setup code is not run again.

## Hosting (GitHub Pages)

The game is published from this repo by `.github/workflows/pages.yml` on every push to `main`.
The hosted version reads map squares from `public-data/osm/` first (no waiting on the map server),
and only downloads squares that aren't packed yet.

To download all of Pitt County (Greenville plus Winterville, Ayden, Farmville, Bethel, Grifton, Fountain, Falkland, Grimesland, Simpson and the countryside, about 2,700 map squares) and publish it, double-click **`fetch-county.cmd`**. It takes a couple of hours the first time and skips anything already downloaded, so you can stop it and run it again later. For just Greenville, double-click **`fetch-city.cmd`** (or run
`npm run fetch-city`, then `publish.cmd`). It asks the map server for the city in ~30 large pieces,
splits them into squares on your PC, packs them into `public-data/osm/`, commits and pushes. If a
busy server skips some squares, just run it again — it only fetches what's missing.

To ship squares you've explored by hand instead: play in dev (squares land in `.cache/`), then
```
npm run pack-data    → copies downloaded squares into public-data/osm/
git add public-data && git commit -m "More map squares" && git push
```
`npm run site` builds the hosted version locally into `site/` if you want to check it first.

## Real-world layers

Each map square also loads three public datasets (saved on your PC after the first download; the game
falls back to its own guesses wherever one isn't available):

- **Aerial photos** — USGS National Map NAIP imagery (USDA summer aerial photography, ~0.6 m,
  public domain), draped on the ground.
- **Buildings** — NC Emergency Management's statewide *NC Risk Building Footprints* (every structure,
  with storeys and occupancy type). Adds the buildings OpenStreetMap is missing, mostly in the
  countryside, and gives mapped buildings their storeys. Footprints date from 2009–12, so ones now
  under a road or a mapped parking lot are skipped.
- **Trees** — Meta / World Resources Institute 1 m canopy height map. Trees stand on the real tree tops
  at their real heights. This one is processed once on your PC: double-click **`fetch-canopy.cmd`**
  (about 550 MB is read from the source files; it resumes if stopped), then `publish.cmd`. It saves
  ~2,700 small files in `public-data/canopy/`.
