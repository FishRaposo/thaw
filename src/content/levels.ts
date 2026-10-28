// The rooms. The core pack was built by hand and by a solver-driven search; each mechanic arrives
// on its own before it is combined with others. Frostbite is a second set that assumes the core
// mechanics and mixes them. `par` is the shortest solution; the tests re-derive it with the solver
// every run, so a par here can never drift from what the level actually needs.

import type { LevelDef, LevelPack } from '../core/types.ts';

const CORE_LEVELS: LevelDef[] = [
  {
    id: 'glide',
    name: 'Glide',
    par: 2,
    note: 'Ice keeps you going. Snow stops you.',
    rows: [
      '########',
      '#@....,#',
      '######.#',
      '######E#',
      '########',
    ],
  },
  {
    id: 'five-stones',
    name: 'Five stones',
    par: 5,
    note: 'Rocks are brakes.',
    rows: [
      '########',
      '#.#..E.#',
      '#.....##',
      '##.....#',
      '#....#@#',
      '########',
    ],
  },
  {
    id: 'crossing',
    name: 'Crossing',
    par: 8,
    rows: [
      '########',
      '#...#E.#',
      '#....#.#',
      '#......#',
      '#,.#...#',
      '#..@.#.#',
      '########',
    ],
  },
  {
    id: 'first-kick',
    name: 'First kick',
    par: 4,
    note: 'Walk into a crate to kick it. It slides like you do, and it makes a good brake.',
    rows: [
      '###########',
      '##........#',
      '#.........#',
      '##........#',
      '##........#',
      '#...#...E.#',
      '#.#.@..B..#',
      '###########',
    ],
  },
  {
    id: 'bridge',
    name: 'Bridge',
    par: 5,
    note: 'A crate that slides into water sinks and freezes into snow.',
    rows: [
      '#########',
      '#..B~...#',
      '#.@.~#..#',
      '#.#.~...#',
      '#...~...#',
      '#..B~...#',
      '#...~..E#',
      '#########',
    ],
  },
  {
    id: 'thin-ice',
    name: 'Thin ice',
    par: 7,
    note: 'Cracked ice breaks behind you.',
    rows: [
      '########',
      '#.*@..##',
      '##..*,.#',
      '#.*.#..#',
      '#.*#E..#',
      '##*...*#',
      '##.....#',
      '########',
    ],
  },
  {
    id: 'long-way-round',
    name: 'Long way round',
    par: 11,
    rows: [
      '############',
      '#..@.......#',
      '#......##.##',
      '##......#..#',
      '##......E#.#',
      '###........#',
      '#.....#....#',
      '############',
    ],
  },
  {
    id: 'placement',
    name: 'Placement',
    par: 10,
    rows: [
      '##########',
      '#....#...#',
      '#...B.E.##',
      '#........#',
      '#.#.....@#',
      '##########',
    ],
  },
  {
    id: 'ferry',
    name: 'Ferry',
    par: 9,
    rows: [
      '#########',
      '#.@.~..E#',
      '#..B~...#',
      '#...~...#',
      '#.B.#...#',
      '#########',
    ],
  },
  {
    id: 'brittle',
    name: 'Brittle',
    par: 11,
    rows: [
      '###########',
      '#.*..*...@#',
      '#....,#...#',
      '#.....##..#',
      '#.*....E..#',
      '#......#..#',
      '#..#..#...#',
      '###########',
    ],
  },
  {
    id: 'crack-and-kick',
    name: 'Crack and kick',
    par: 10,
    rows: [
      '#########',
      '#..*.##.#',
      '#...*.#.#',
      '#....*..#',
      '#.#E#...#',
      '#.@#.,*.#',
      '#..B....#',
      '#########',
    ],
  },
  {
    id: 'thaw',
    name: 'Thaw',
    par: 14,
    rows: [
      '##########',
      '#..@..~.E#',
      '#...B.~#.#',
      '##.B..~.##',
      '#.....~..#',
      '#.....~#.#',
      '##########',
    ],
  },
];

// A second set for players who know the core mechanics. These rooms came from the same search
// tool and were picked for a readable shape and one clear idea each.
const FROSTBITE_LEVELS: LevelDef[] = [
  {
    id: 'cold-open',
    name: 'Cold open',
    par: 6,
    note: 'Crates are brakes.',
    rows: [
      '##########',
      '#.......##',
      '##E...#.@#',
      '#.#......#',
      '##...B#..#',
      '#...#...B#',
      '##########',
    ],
  },
  {
    id: 'sluice',
    name: 'Sluice',
    par: 7,
    note: 'A crate is also a bridge.',
    rows: [
      '########',
      '#.B.~..#',
      '#@..~E.#',
      '###.~..#',
      '#.#.~..#',
      '########',
    ],
  },
  {
    id: 'freight',
    name: 'Freight',
    par: 7,
    note: 'Two crates, two jobs.',
    rows: [
      '###########',
      '#B.....##@#',
      '#.........#',
      '#....#E...#',
      '#.#.......#',
      '##.....B..#',
      '###########',
    ],
  },
  {
    id: 'thin-floor',
    name: 'Thin floor',
    par: 7,
    note: 'The ice you break is a stop you made.',
    rows: [
      '#########',
      '#.*..@#.#',
      '#*E#...##',
      '#**.....#',
      '#*#....*#',
      '#.......#',
      '#*#*....#',
      '#########',
    ],
  },
  {
    id: 'whiteout',
    name: 'Whiteout',
    par: 8,
    note: 'Every crack is a door and a wall.',
    rows: [
      '###########',
      '#.#..##..*#',
      '#.........#',
      '#.@...#...#',
      '#.....E...#',
      '#...#.....#',
      '#**#......#',
      '###########',
    ],
  },
];

export const CORE_PACK: LevelPack = {
  id: 'long-thaw',
  name: 'The Long Thaw',
  version: 1,
  levels: CORE_LEVELS,
};

export const FROSTBITE_PACK: LevelPack = {
  id: 'frostbite',
  name: 'Frostbite',
  version: 1,
  levels: FROSTBITE_LEVELS,
};

export const PACKS: LevelPack[] = [CORE_PACK, FROSTBITE_PACK];

// Convenience alias for the core rooms; tests and task checks use it.
export const LEVELS = CORE_PACK.levels;
