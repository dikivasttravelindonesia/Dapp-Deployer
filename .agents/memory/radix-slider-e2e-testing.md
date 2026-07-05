---
name: Radix Slider e2e test flakiness
description: Playwright-driven testing agents can mis-set a Radix UI Slider's value when clicking/dragging before sending key presses, producing false "bug" reports.
---

When a test plan tells the testing subagent to "click the slider thumb" and then press a key (Home/ArrowRight/etc.), the initial click can land on an arbitrary point on the slider track rather than precisely on the thumb, silently changing the value before the key press is even sent. Subsequent key presses then appear to "jump" by more than one step, or a value that should render N items renders 0/wrong count.

**Why:** A liquidity-modal bin-range slider (min=0, max=10, step=1) reported "0 bars rendered at radius=0" and "ArrowRight jumped from ±0 to ±6" in an e2e run. Re-running a narrower test with exactly one click + one `Home` key press (no extra actions) showed correct behavior every time — the app code was fine; the flakiness was in how the browser automation interacted with the slider.

**How to apply:** If an e2e test reports a strange/inconsistent value on a Radix Slider (or similar drag-based control), don't assume the app is broken. Re-run a minimal, single-action test plan (one click directly on the thumb, one key press, immediately verify) to isolate real bugs from automation-interaction noise before spending time debugging application code.
