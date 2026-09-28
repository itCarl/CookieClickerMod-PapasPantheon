# Papa's Pantheon

Presets and save slots for the Cookie Clicker Temple, priced at the true minimum before you spend a swap.

![Release](https://img.shields.io/github/v/release/itCarl/cookie-clicker-papas-pantheon) ![CI](https://github.com/itCarl/cookie-clicker-papas-pantheon/actions/workflows/release.yml/badge.svg) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

<details>
<summary>Table of Contents</summary>

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [How it works](#how-it-works)
- [Development](#development)
- [License](#license)

</details>

## About

Papa's Pantheon adds presets and named save slots to the Temple / pantheon
minigame. Rearranging spirits is the most expensive routine action in the game:
a worship swap returns after 1, 4 and 16 hours, so spending all three and
getting back to full takes **twenty-one hours**.

Every preset and slot therefore shows its true minimum swap cost before you
touch it. The cost is found by a breadth-first search over arrangements that
models the game's own rule: `M.slotGod` makes two spirits exchange places when
one is dropped on an occupied socket. Two spirits trading sockets is one drag,
not two - counting differing sockets would say five hours when it costs one.

## Features

- **True minimum cost** on every button, not the number of sockets that differ.
- **Six presets** for the ways people actually play, each naming what it gives
  **and what it takes**:

  | Preset | Diamond / Ruby / Jade | The catch |
  |---|---|---|
  | Idle production | Holobore / Jeremy / Mokalsium | Holobore unslots itself and burns every swap when you click a golden cookie. |
  | Click combo | Godzamok / Muridal / Vomitrax | Sell buildings to trigger the click buff; Jeremy and Mokalsium are absent because both make golden cookies rarer. |
  | Golden cookies | Vomitrax / Cyclius / Rigidel | Nothing here reduces how often cookies appear. |
  | Wrinkler farm | Skruuia / Jeremy / Mokalsium | Skruuia turns every golden cookie into a wrath cookie. |
  | Building spree | Dotjeiess / Jeremy / Mokalsium | Costs 30% of your heavenly chip effect - take it out before ascending. |
  | Sugar lumps | Rigidel / Jeremy / Mokalsium | None. Rigidel is simply narrow. |

- **Unlimited named save slots** for your own arrangements, stored in your save
  file and priced the same way. Saving is free - only applying costs.
- **Two or more swaps ask first**, naming the real wait. Nothing is applied that
  cannot be paid for.
- Swap counter with time until the next swap returns, read from the game's own
  curve.

## Installation

### Manual

1. Download `PapasPantheon.zip` from the
   [GitHub Releases](https://github.com/itCarl/cookie-clicker-papas-pantheon/releases) page.
2. Unzip it into `<Cookie Clicker>/resources/app/mods/local/PapasPantheon/`.
3. Restart the game and enable the mod under **Options -> Mods**. The panel
   appears under the Temple.

## How it works

- **Cost search.** There are only three sockets, so the mod searches the space
  of arrangements for the shortest sequence of drags, applying the game's swap
  rule at each step. An exact answer is cheaper than a clever rule that might be
  wrong.
- **Applying.** Each drag moves the spirit's own element into the socket exactly
  the way dropping it by hand does, so the Temple shows the arrangement it
  actually has.
- **Safety.** Slots naming a spirit the game does not have are dropped on load.
  Ascending empties the pantheon, so a pending confirmation is dropped on reset.
- **No reimplementation.** Values are read from the game's own functions rather
  than transcribed. `Game.mods['papas pantheon']` exposes a small read-only API.
- **ASCII-only source**, because the game's `index.html` declares no
  `<meta charset>` and injects mod scripts with `createElement('script')`.

## Development

```
mod/        what the game loads, and all that ships to the Workshop
moddev/     the test harness - never loaded, never shipped
```

The game publishes a mod by zipping its folder whole, so anything beside
`main.js` would be uploaded to every subscriber. The harness and the
repository's `.git` directory live outside `mod/` for that reason.

Run the tests:

```
cd moddev && node test.js
```

The tests need the game's sources from a local Steam install of Cookie Clicker:
`moddev/pantheon.js` loads the game's own `minigamePantheon.js` into a sandbox
with DOM stubs, so a passing test exercises the real thing. The key test plans
300 random rearrangements, **executes each plan through the game's own
`slotGod`**, and checks that the predicted cost is the true minimum, the plan
lands on the target, and it spends exactly what it said it would.

| Script | Purpose |
|---|---|
| `moddev/test.js` | behavioural tests |
| `moddev/make_thumbnail.py` | redraws the Workshop thumbnail |

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
