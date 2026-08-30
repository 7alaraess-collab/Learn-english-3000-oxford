---
name: Flashcard session interaction
description: Shared study and review flashcards use parent-controlled face state with inactive hidden-side controls.
---

The shared flashcard owns the interaction surface, while each session owns the revealed state and resets it when the current word changes.

**Why:** Study, daily-set, starred, and milestone-review flows all reuse the same card, so keeping navigation state above the card prevents a previous word's face from persisting into the next word.

**How to apply:** Any future flashcard action should work from both pointer and keyboard input, and controls on the rotated-away face must not be clickable or focusable.