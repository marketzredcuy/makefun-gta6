# Solmar Bay — an open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/marketzredcuy/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/marketzredcuy/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a top-down open-world crime game that runs in a desktop browser
from static files, no network needed. Explore a sun-soaked coastal city on
foot and by car: steal cars, dodge traffic and pedestrians, outrun the police
as your wanted level climbs, and finish all three of Mara Voss's missions.

## The city

A 2400×1800 city with a road grid, five named districts (Old Town, Downtown,
Voss Park, the Marina and South Beach), a beach and a marina. Traffic drives
the roads and turns at intersections; pedestrians walk the sidewalks; police
cars spawn when you are wanted and chase you down.

## Missions

1. **Hot Wheels** — steal any car and bring it to the Marina.
2. **The Package** — pick up a package in Old Town and deliver it to South
   Beach in 75 seconds.
3. **Heat** — survive 45 seconds at 3 wanted stars, then reach the safehouse.

Finishing a mission pays out; finishing all three makes the city yours.
Progress is saved to localStorage between visits.

## Controls

- **WASD / arrows** — walk, or drive when in a car
- **E** — enter or exit a car (stealing one raises your wanted level)
- **Shift** — handbrake (drift)
- **P / Esc** — pause · **M** — sound on/off · **Space** — start / restart

## Run it

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). The screenshots in `screenshots/` are renders of the game itself:
the title screen, driving through town, a police chase and the package run.

## License

MIT. See `LICENSE`.
