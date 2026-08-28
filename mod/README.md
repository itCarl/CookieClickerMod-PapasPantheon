# Papa's Pantheon

Presets and save slots for the Temple's pantheon, for a minigame where changing
your mind is the most expensive thing you can do.

Install: the folder sits in `mods/local/PapasPantheon`. Restart the game and
enable it under **Options -> Mods**. The panel appears under the Temple.

---

## Why this needs care rather than convenience

A worship swap is one drag, and they come back on a punishing curve
(`minigamePantheon.js`, `M.logic`):

```
the 3rd swap returns after   1 hour
the 2nd swap returns after   4 hours
the 1st swap returns after  16 hours
```

Spending all three and getting back to full is **twenty-one hours**. A mod that
made rearranging one click easier without making the price obvious would be
actively harmful, so every button here is priced before you touch it and
anything costing two or more asks first.

## The price shown is the real one

The obvious way to cost a rearrangement is to count the sockets that differ.
That is wrong, and wrong in the expensive direction.

`M.slotGod` does not simply place a spirit: if the target socket is occupied,
**the two exchange places**. So two spirits trading sockets is one drag, not
two, and a three-way rotation is two, not three. Counting differing sockets
would tell you five hours when it costs one.

This works the cost out by searching the space of arrangements for the shortest
sequence of drags. There are only three sockets, so an exact answer is cheaper
than a clever rule that might be wrong.

`moddev/test.js` checks that claim against the game rather than against itself:
300 random rearrangements, each one planned, then **actually executed through
the game's own `slotGod`**, then compared. The predicted cost is always the true
minimum, the plan always lands on the target, and it always spends exactly what
it said it would.

## The presets

Six arrangements for the ways people actually play. Hover one for what it does
and, more usefully, what it costs you - every spirit in this game gives with one
hand and takes with the other.

| Preset | Diamond / Ruby / Jade | The catch |
|---|---|---|
| **Idle production** | Holobore / Jeremy / Mokalsium | Holobore unslots itself and burns every swap the moment you click a golden cookie. This is for leaving the game alone. |
| **Click combo** | Godzamok / Muridal / Vomitrax | Sell buildings to trigger the click buff. Jeremy and Mokalsium are deliberately absent - both make golden cookies rarer. |
| **Golden cookies** | Vomitrax / Cyclius / Rigidel | Nothing here reduces how often cookies appear, which rules out the two obvious CpS spirits. |
| **Wrinkler farm** | Skruuia / Jeremy / Mokalsium | Skruuia turns every golden cookie into a wrath cookie. |
| **Building spree** | Dotjeiess / Jeremy / Mokalsium | Dotjeiess costs you 30% of your heavenly chip effect - take it out before ascending. |
| **Sugar lumps** | Rigidel / Jeremy / Mokalsium | None. Rigidel is simply narrow. |

## Your own slots

**Save what is in the Temple** records the current arrangement under a readable
name. Saving costs nothing - only applying does. Slots are kept in your save
file, priced like the presets, and marked *in place* when they already are.

A slot naming a spirit the game does not have is dropped on load rather than
kept as something that would quietly do the wrong thing.

## Reading the panel

- **Worship swaps 2/3 - next in 47m** — how many you have and when the next one
  lands, from the game's own curve.
- **Now** — the three sockets, each naming its spirit and, on hover, what it
  gives and what it takes.
- **Presets** — dimmed when you cannot afford them, highlighted when already in
  place, and priced underneath.
- Anything costing two swaps or more raises a question naming the real wait
  before it spends anything.

## Notes

- Applying moves the spirit's own element into the socket exactly the way
  dropping it does, so the Temple shows the arrangement it actually has.
- Ascending empties the pantheon, so a pending question is dropped on reset.
- ASCII-only source: the game's `index.html` declares no `<meta charset>` and
  injects mod scripts with `createElement('script')`.
- `Game.mods['papas pantheon']` exposes a small read-only API, which is what the
  tests drive.
