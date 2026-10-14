# Security Policy

## Scope

Rail Tangle is a static client-side browser puzzle. It performs no network
requests, collects no personal data, executes no server code, and has zero
runtime third-party dependencies. The attack surface is limited to the
rendering code in `src/ui.js` and the bundled `dist/game.js`.

## Reporting a vulnerability

If you find a security issue, do not open a public issue. Instead, email the
maintainer at the address listed on the repository profile, or open a private
security advisory via GitHub.

Please include:

- a description of the issue and its impact
- steps to reproduce
- a suggested fix, if you have one

## Responsible disclosure

We ask that you do not exploit the issue beyond demonstrating it in an
isolated environment, and that you give us a reasonable window (30 days) to
produce a fix before public disclosure.

## Safe usage

Open this game only from sources you trust. The bundled `dist/game.js` is
generated from committed source in CI; if you rebuild it yourself, verify
your toolchain.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | yes       |

## Contact

Maintainer: Wsh7Ash (GitHub). Report via GitHub private vulnerability report.