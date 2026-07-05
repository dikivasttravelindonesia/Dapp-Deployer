---
name: One-sided AMM bin deposits
description: DLMM/bin-based AMM contracts typically enforce one-sided liquidity deposits for bins away from the active price bin; client-side multi-bin allocation must respect this.
---

In discrete-bin AMMs (Meteora-style DLMM), each bin holds reserves for one price point. Bins above the active bin are priced entirely in token X (they'll only be needed if price rises into them), and bins below are priced entirely in token Y. Only the active bin can hold both. Contracts enforce this with an assert (e.g. `assert!(amount_y == 0, "only token_x allowed above active bin")`), which on Soroban/Wasm surfaces as an opaque `HostError: Error(WasmVm, InvalidAction) ... UnreachableCodeReached` — there is no readable revert string in the client-visible error.

**Why:** A multi-bin "Add Liquidity" UI split both total token amounts evenly (by strategy weight) across every bin in the selected range, including sending nonzero token_x to bins below the active bin and nonzero token_y to bins above it. This passed typecheck and looked correct in the UI, but every multi-bin (radius > 0) submission panicked in the contract.

**How to apply:** When building any multi-bin liquidity allocation UI for a DLMM-style contract, normalize weights *separately* per token: token X's weight distributes only across bins >= active bin (renormalized over just that subset), token Y's weight distributes only across bins <= active bin, and the active bin is the only one that receives both. Never take one weight distribution and reuse it for both tokens across a range that includes off-active bins.
