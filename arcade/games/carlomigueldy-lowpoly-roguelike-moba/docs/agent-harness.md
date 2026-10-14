# Agent Harness

The agent harness is a lightweight local context and verification script for future coding agents.

## Purpose

It gives agents a repeatable way to understand the project before editing and a quick verification command after editing.

## Run

```bash
npm run harness
```

## What it checks

- Required project files exist.
- Source modules are present.
- Continuation docs are present.
- Recommended verification commands are printed.
- Current git status is shown when the project is inside a git repo.

## What it does not do

- It does not run a browser.
- It does not publish to GitHub.
- It does not modify files.
- It does not replace manual playtesting.

## Agent checklist

Before work:

```bash
npm run harness
```

After work:

```bash
npm run check
npm run harness
npm run dev
```

Then manually test `http://localhost:5173`.
