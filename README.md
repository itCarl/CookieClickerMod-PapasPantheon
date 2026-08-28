# Papa's Pantheon

Presets and save slots for the Temple's pantheon in Cookie Clicker. Rearranging
spirits is the most expensive routine action in the game, so every preset is
priced before you touch it - and the price shown is the true minimum, not the
number of sockets that differ.

Cookie Clicker Temple / pantheon minigame. Version 1.0.

- A worship swap returns after 1, 4 and 16 hours: spending all three and getting
  back to full is **twenty-one hours**. Nothing here spends one without saying so.
- **The cost shown is the real one.** `M.slotGod` makes two spirits exchange
  places when one is dropped on an occupied socket, so two spirits trading
  sockets is one drag, not two. Counting differing sockets would say five hours
  when it costs one.
- Six presets for the ways people actually play, each explaining what it gives
  **and what it takes** - every spirit in this game does both.
- Unlimited named slots for your own arrangements, priced the same way.
- Anything costing two swaps or more asks first, naming the real wait.

## Layout

```
mod/        what the game loads, and all that ships to the Workshop
moddev/     the test harness - never loaded, never shipped
```

The split matters: the game publishes a mod by zipping its folder whole
(`resources/app/start.js`), so anything sitting beside `main.js` is uploaded to
every subscriber. The harness lives outside `mod/` so that cannot happen, and
the repository's own `.git` directory is outside it for the same reason.

## Installing

`mod/` is what goes into `Cookie Clicker/resources/app/mods/local/PapasPantheon`.
On the machine this was developed on that path is a directory junction pointing
here, so the game and the repository share one copy and an edit is live
immediately.

Restart the game and enable the mod under **Options -> Mods**.

## Testing

```
cd moddev
node test.js
```

103 tests. They do not run against a model of the game - `moddev/pantheon.js`
loads Cookie Clicker's own `minigamePantheon.js` into a sandbox with stubs for
the DOM, so a passing test is testing the real thing.

The one that matters most takes 300 random rearrangements, plans each, then
**executes the plan through the game's own `slotGod`** and compares. The
predicted cost is always the true minimum, the plan always lands on the target,
and it always spends exactly what it said it would.

| Script | What it answers |
|---|---|
| `moddev/test.js` | behavioural tests |
| `moddev/make_thumbnail.py` | redraws the Workshop thumbnail |

The harness resolves its paths for both locations, so the tests run from the
repository and from inside the game tree.

## A note on history

This repository starts at v1.0, which is the first version there was.
