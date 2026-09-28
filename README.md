<a id="readme-top"></a>

<div align="center">
  <img src="docs/logo.png" alt="Logo" width="128" height="128">

  <h3 align="center">Papa's Pantheon</h3>

  <p align="center">
    Presets and save slots for the Cookie Clicker Temple, priced at the true minimum before you spend a swap.
    <br />
    <a href="https://github.com/itCarl/CookieClickerMod-PapasPantheon/releases"><strong>Download the latest release</strong></a>
    <br />
    <br />
    <a href="https://github.com/itCarl/CookieClickerMod-PapasPantheon/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/itCarl/CookieClickerMod-PapasPantheon/issues/new?labels=enhancement">Request Feature</a>
  </p>

  <a href="https://github.com/itCarl/CookieClickerMod-PapasPantheon/releases"><img src="https://img.shields.io/github/v/release/itCarl/CookieClickerMod-PapasPantheon" alt="Release"></a>
  <a href="https://github.com/itCarl/CookieClickerMod-PapasPantheon/actions/workflows/release.yml"><img src="https://github.com/itCarl/CookieClickerMod-PapasPantheon/actions/workflows/release.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#how-it-works">How It Works</a></li>
    <li><a href="#development">Development</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

Papa's Pantheon adds presets and named save slots to the Temple / pantheon
minigame. Rearranging spirits is the most expensive routine action in the game:
a worship swap returns after 1, 4 and 16 hours, so spending all three and
getting back to full takes **twenty-one hours**.

Every preset and slot therefore shows its true minimum swap cost before you
touch it. The cost is found by a breadth-first search over arrangements that
models the game's own rule: `M.slotGod` makes two spirits exchange places when
one is dropped on an occupied socket. Two spirits trading sockets is one drag,
not two - counting differing sockets would say five hours when it costs one.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Installation

### Manual

1. Download `PapasPantheon.zip` from the
   [GitHub Releases](https://github.com/itCarl/CookieClickerMod-PapasPantheon/releases) page.
2. Unzip it into `<Cookie Clicker>/resources/app/mods/local/PapasPantheon/`.
3. Restart the game and enable the mod under **Options -> Mods**. The panel
   appears under the Temple.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How It Works

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

- [Orteil's Cookie Clicker](https://orteil.dashnet.org/cookieclicker/) - the game this mod reads everything from

<p align="right">(<a href="#readme-top">back to top</a>)</p>
