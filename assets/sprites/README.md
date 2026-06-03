# Character sprites

Finished AI-generated character art lives here, one file per hero id:

```
assets/sprites/cassia.png
assets/sprites/elin.png
assets/sprites/branwen.png
assets/sprites/veyr.png
```

## How it plugs in

1. Generate matching art with `tools/sprite-forge.html` (style locked by `tools/STYLE.md`).
2. Save the finished image here with the exact id as the filename.
3. In `game.js`, find the `const SPRITES = { … }` block and uncomment the line for
   that hero (e.g. `cassia: 'assets/sprites/cassia.png',`).
4. Reload. The raster replaces that hero's inline-SVG portrait **everywhere** —
   cards, toasts, cinematics, award backdrops — because every renderer reads from
   the same `PORTRAITS` map the override patches.

Leave a hero's `SPRITES` line commented out to keep its hand-built SVG fallback.
Transparent PNG (or WebP) recommended so the parchment background doesn't fight
the in-game card. Crop to roughly **10:13** for the tightest card fit.
