# Next level starts with a move already made

*QA ticket · severity: major · build: main*

**Summary.** If you keep pressing a direction while the winning slide is still animating, the next level (or a restart) starts with that move already played.

**Steps to reproduce**
1. Level 1. Press right, then down. While the down slide is still moving toward the hut, press up.
2. Press Enter for level 2.

**Expected.** Level 2 starts with the player on the start tile and "moves 0".

**Actual.** Level 2 starts and the player immediately slides up: "moves 1" before you've touched anything. The same happens with restart if you press a direction during a slide and then press R. Players lose the 3-star par on that level through no fault of their own.

**Frequency.** Every time a direction is pressed during the last slide or right before a restart.
