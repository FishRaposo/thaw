# Reference solution

**Root cause.** Presses made during a slide wait in `Session.queue` until the slide ends. When the winning slide ends, the session switches to the "won" screen, and the queue is ignored there, but it isn't emptied. `start()`, which both "next level" and "restart" go through, no longer resets the queue. The first `tick()` of the new level finds moves waiting and plays them.

**How to find it by playtesting.** It needs input during an animation, so slow, careful testers never see it, and fast players hit it constantly. The ticket's steps reproduce it every time.

**Fix** (`reference-solution.patch`): `start()` empties the queue, alongside the history, the timer and the result it already resets. Everything that begins a level goes through `start()`, so one line covers next, restart and the level menu.

**Rejected alternative.** Clearing the queue in `finish()` fixes "next level" but not restart, and leaves the queue holding stale input while the won screen is up.
