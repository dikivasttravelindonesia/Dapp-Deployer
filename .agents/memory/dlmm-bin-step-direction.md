---
name: DLMM bin-step traversal direction
description: How to reason about which direction a bin-based AMM must walk when the active bin runs dry, for one-sided liquidity layouts.
---

In a discrete-bin AMM (Meteora/DLMM-style) where each bin holds liquidity of only one token relative to the active bin (bins above hold only token X, bins below hold only token Y, and the active bin can hold both), the traversal direction when a bin is exhausted mid-swap must point toward the side that holds the token being bought — not an arbitrary/index-increasing default.

**Why:** A naive implementation can default to "always step +1" (or copy the direction from one swap side to the other) because both directions compile and pass simple single-bin tests. It only breaks once a swap has to cross an exhausted bin, at which point the active-bin pointer permanently walks into empty territory. This fails silently: `simulate_swap`/quote calls return `amount_out=0` instead of erroring, and any bins the pointer already skipped past become effectively unreachable for that pool. There's no general way to "undo" this once the active bin has been overwritten past the real liquidity — it typically requires deploying a corrected contract and reseeding, not a data patch.

**How to apply:** When implementing or reviewing bin traversal logic, derive the step direction from the deposit-side convention explicitly: buying token Y (spending X) must step toward the bins that hold Y, and vice versa. Write this as an explicit branch (`step = if buying_y { toward_y_bins } else { toward_x_bins }`) rather than reusing a shared "direction" variable across both swap directions, and add a bin-crossing test (not just single-bin) to catch regressions. Keep any read-only quote/simulate function in exact parity with the state-changing swap function — both must use the same direction logic.
