# Hints

*Producer request*

> We're losing players around levels 7 to 10. Analytics show long sessions on one room, then they quit. We already have a solver that proves every level works, so let's put it in the players' hands: a hint button.
>
> Press H (or tap "hint", or X on a controller) and the game shows an arrow for the next move. It has to work from wherever the player is, not just from the start: if they've wandered off, the hint should bring them back on the fastest route from there. If they've broken the ice behind them and the room can't be finished anymore, don't point anywhere. Tell them plainly there's no way out from here and that undo or restart will help.
>
> Hints are free to use but they cost the perfect score: a level finished with any hint gets at most two stars, even at par. Show "hint used" next to the move counter and on the results card so it never feels like a bug. Asking for a hint shouldn't count as a move, and the arrow should disappear as soon as they move.
