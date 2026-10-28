# Thaw — adding content

Thaw's content is rooms, grouped into packs. A room is data plus a par that the solver can prove.

## A room

```ts
{
  id: 'bridge',            // stable; progress and saves key on it
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
}
```

Tiles: `#` rock, `.` ice, `,` snow, `~` water, `*` cracked ice, `E` exit, `@` player, `B` crate. A room must contain exactly one `@`; `E` is the goal. A move that changes nothing does not count.

## Add a room

1. Decide the one idea the room teaches. New mechanics arrive alone before they are combined.
2. Use `scripts/search.mjs` to propose candidates with the chosen elements and a target solution length. Read the candidates; pick by hand for readability and a moment of insight.
3. Put the room in a pack in `src/content/levels.ts`, give it a stable `id`, set `par` to the solver's solution length, and add a one-line `note` if it introduces a mechanic.
4. Run `npm test`. It re-solves every room in every pack, replays the solution, checks that every room with crates actually needs them, and checks id uniqueness.
5. Run `npm run tasks`; the task pack must still fail-before/pass-after.
6. Add a test or extend an invariant if the room exercises a new edge case.

## Add a pack

1. Define `{ id, name, version, levels }` in `src/content/levels.ts` and add it to `PACKS`.
2. Give every room a stable id that is unique across packs.
3. Run `npm test` and `npm run smoke`; the level select shows one tab per pack, and progress is stored per pack and room id.
4. Do not reuse old ids for different rooms: saved progress is keyed on them.

## Rules

- Never type a par by hand without the solver agreeing.
- If a room has a mechanic, the mechanic must be required: removing it should make the room unsolvable or slower than par.
- No hidden information: the whole board is visible.
- A room should read at 390 px width. Prefer fewer elements and a clear first move.
- Do not add a new tile type to make one room work; add it as a reusable mechanic with rules, rendering, tests and a note.
- Keep room data in `content/`; if the room needs new core logic, add a tested rule hook first.
