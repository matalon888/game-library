# Validation

Version 0.3.0 passed 29 deterministic rules/record tests and 35 browser checks (14 base, 11 variant, 10 Relaxed). Browser checks used Microsoft Edge and Playwright. They covered tutorial matches using falling rain, input, pause/retry, settings, score migration and separation, forecasts, skins, relaxed clocks, and responsive layouts. Screens were visually inspected. See BUILD.md to reproduce checks; generated evidence stays outside Git.

Twelve seeded diagnostic-policy runs exercised all three game types without injected shields or pigments. All retained position/pigment/minimum-length/skin-overlap invariants; the Afterimage runs included actual skin collection and dissolution. These are integration checks, not evidence of human difficulty or enjoyment.

The Wild regression test embeds a digest from the original simulation and compares a full seeded storm's events and state. Source exports need no private development Git history to run it. Relaxed tests check scaled timing, growth, health, five-minute completion and independent score slots.

Packaged web started and accepted keyboard input in a sandboxed iframe. Native runtime notices were present and embedded game files matched the tested source byte for byte. The native diagnostic launched and responded with no uncaught game errors.

## Native limitation

The restricted development environment could not launch Electron's normal sandboxed child process (`launch-failed`, exit 0xC0000135). A packaged diagnostic with explicit `--no-sandbox --disable-gpu --smoke-test` and a task-local RAINCOIL_TEST_PROFILE passed. That is not proof of ordinary native launch. Neither the sandbox override nor test profile is enabled for players by default. Normal launch should be checked in an ordinary Windows user session.

## Limits

Play feedback informed Relaxed pace, but there has been no broad human playtest or hardware/browser compatibility survey. Pigment symbols supplement colors; this is not formal accessibility certification. Keyboard is the primary input target. Whether forecasts and skins make planning satisfying remains a question for play feedback.
