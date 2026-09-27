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
| `05_env`, `06_player`, `06b_plane`, `07_traffic`, `08_ui`, `09_main`, `04e_overview` | New code swaps in instantly; you keep your position, speed and everything else |
| `03j_airport` | Swaps in, then the plane model and airport are rebuilt around you |
| `04_world`, `04b_food`, `04c_neighborhoods`, `04d_streets`, `03g_food`, `03h_retail`, `03i_parcels` | Swaps in, then the map squares around you are rebuilt with the new code |
| `01_core`, `02_render_textures`, `03_models`, `03c`–`03f` (people/avatars), `template.html` | The page reloads and puts you back where you were (walking, driving or flying) |

Pressing F5 also brings you back to where you were.

If Vite gives you trouble, `npm run dev:plain` runs the same live-reloading server with no dependencies.

### Saved map data
The dev server runs on `localhost`, which keeps its own copy of the downloaded map (separate from the
Desktop file). To skip re-downloading Greenville: in the Desktop version use **Export map data**, then
in the dev version use **Import**.

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
