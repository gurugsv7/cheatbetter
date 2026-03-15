# Repo Guidelines

This repository is a fork of [`hintio`](https://github.com/sohzm/hintio).
It provides an Electron-based real‑time assistant which captures screen and audio
for contextual AI responses. The code is JavaScript and uses Electron Forge for
packaging.

## Getting started

Install dependencies and run the development app:

```
1. npm install
2. npm start
```

## Style

Run `npx prettier --write .` before committing. Prettier uses the settings in
`.prettierrc` (four-space indentation, print width 150, semicolons and single
quotes). `src/assets` and `node_modules` are ignored via `.prettierignore`.
The project does not provide linting; `npm run lint` simply prints
"No linting configured".

## Code standards

Development is gradually migrating toward a TypeScript/React codebase inspired by the
[transcriber](https://github.com/Gatecrashah/transcriber) project. Keep the following
rules in mind as new files are created:

- **TypeScript strict mode** – avoid `any` and prefer explicit interfaces.
- **React components** should be functional with hooks and wrapped in error
  boundaries where appropriate.
- **Secure IPC** – validate and sanitize all parameters crossing the renderer/main
  boundary.
- **Non‑blocking audio** – heavy processing must stay off the UI thread.
- **Tests** – every new feature requires tests once the test suite is available.

## Shadcn and Electron

The interface is being rebuilt with [shadcn/ui](https://ui.shadcn.com) components.
Follow these guidelines when working on UI code:

- **Component directory** – place generated files under `src/components/ui` and export them from that folder.
- **Add components with the CLI** – run `npx shadcn@latest add <component>`; never hand-roll components.
- **Component pattern** – use `React.forwardRef` with the `cn()` helper for class names.
- **Path aliases** – import modules from `src` using the `@/` prefix.
- **React 19 + Compiler** – target React 19 with the new compiler when available.
- **Context isolation** – maintain Electron's context isolation pattern for IPC.
- **TypeScript strict mode** – run `npm run typecheck` before claiming work complete.
- **Tailwind theming** – rely on CSS variables and utilities in `@/utils/tailwind` for styling.
- **Testing without running** – confirm `npm run typecheck` and module resolution with `node -e "require('<file>')"`.

## Tests

No automated tests yet. When a suite is added, run `npm test` before each
commit. Until then, at minimum ensure `npm install` and `npm start` work after
merging upstream changes.

## Merging upstream PRs

Pull requests from <https://github.com/sohzm/hintio> are commonly
cherry‑picked here. When merging:

1. Inspect the diff and keep commit messages short (`feat:` / `fix:` etc.).
2. After merging, run the application locally to verify it still builds and
   functions.

## Strategy and Future Work

We plan to extend this project with ideas from the
[`transcriber`](https://github.com/Gatecrashah/transcriber) project which also
uses Electron. Key goals are:

- **Local Transcription** – integrate `whisper.cpp` to allow offline speech-to-
  text. Investigate the architecture used in `transcriber/src/main` for model
  validation and GPU acceleration.
- **Dual Audio Capture** – capture microphone and system audio simultaneously.
  `transcriber` shows one approach using a native helper for macOS and
  Electron's `getDisplayMedia` for other platforms.
- **Speaker Diarization** – explore tinydiarize for identifying speakers in mono
  audio streams.
- **Voice Activity Detection** – skip silent or low‑quality segments before
  sending to the AI service.
- **Improved Note Handling** – store transcriptions locally and associate them
  with meeting notes, similar to `transcriber`'s note management system.
- **SA Round Simulator** – dedicated Data Structure & Algorithm (DSA) interview
  practice tool where students explain their approach out loud while typing code,
  with real-time voice analysis and post-round report cards on communication,
  approach quality, time management, and panic recovery.
- **Testing Infrastructure** – adopt Jest and React Testing Library (if React is
  introduced) to cover audio capture and transcription modules, including SA Round
  metrics calculation.

### TODO

1. Research and prototype local transcription using `whisper.cpp`.
2. Add dual‑stream audio capture logic for cross‑platform support.
3. Investigate speaker diarization options and integrate when feasible.
4. Build DSA problem database (~100–200 problems) keyed by company and difficulty
   tier.
5. Implement real-time voice analysis for problem clarification, approach
   explanation, filler words, complexity discussion, and panic recovery detection.
6. Design and build SA Round Simulator UI: role selection, problem display,
   live code editor, timer, and report card views.
7. Implement post-round report generation with communication, approach structure,
   time management, and panic recovery scores.
8. Plan a migration path toward a proper testing setup (Jest or similar).
9. Document security considerations for audio storage and processing.
10. Rebuild the entire UI using shadcn components.
11. Integrate session playback and code review tools for post-round feedback.

These plans are aspirational; implement them gradually while keeping the app
functional.

## Audio processing principles

When implementing transcription features borrow the following rules from
`transcriber`:

- **16 kHz compatibility** – resample all audio before sending to whisper.cpp.
- **Dual‑stream architecture** – capture microphone and system audio on separate
  channels.
- **Speaker diarization** – integrate tinydiarize (`--tinydiarize` flag) for mono
  audio and parse `[SPEAKER_TURN]` markers to label speakers (Speaker A, B, C…).
- **Voice activity detection** – pre‑filter silent segments to improve speed.
- **Quality preservation** – keep sample fidelity and avoid blocking the UI
  during heavy processing.
- **Memory efficiency** – stream large audio files instead of loading them all at
  once.
- **Error recovery** – handle audio device failures gracefully.

## Privacy by design

- **Local processing** – transcriptions should happen locally whenever possible.
- **User control** – provide clear options for data retention and deletion.
- **Transparency** – document what is stored and where.
- **Minimal data** – only persist what is required for functionality.

## SA Round Simulator implementation guide

When building the SA Round Simulator feature, follow these principles:

### Audio analysis for coding rounds
- **Clarification detection** – look for questions (e.g., "What if...", "Can I assume...")
  before solution design begins; flag if student jumps straight to coding.
- **Approach verbalization** – detect explanation phase ("I'll use a hash map
  because...") before or concurrent with code writing.
- **Filler words** – count "um", "uh", "like", "you know" as indicators of
  thinking time; correlate with pause duration for confusion signals.
- **Complexity articulation** – extract time/space complexity statements via NLP;
  cross-check against actual solution if code analysis is available.
- **Panic indicators** – detect tone change, rapid filler word increases, explicit
  statements like "I'm stuck" or "I don't know"; measure recovery (pivot to
  brute force, ask for hints, refocus).

### Problem database strategy
- Curate problems from real company interview reports (Blind, LeetCode Discuss,
  Glassdoor).
- Tag each problem: company, role (SDE, Data Engineer, etc.), difficulty tier
  (Easy/Medium/Hard), and year added.
- Avoid arbitrary LeetCode classifications; validate difficulty by cross-referencing
  student success rates and company feedback.
- Rotate problems regularly and gather feedback from users on calibration accuracy.

### Report card design
- Match the styling and layout of existing behavioral interview report cards.
- Include quantitative metrics (score 0–100 for each dimension) and qualitative
  feedback (e.g., "Strong problem clarification; consider mentioning edge cases").
- Provide actionable next-step suggestions (e.g., "Practice explaining your
  complexity analysis before coding").
- Allow students to review session transcript and recorded audio for self-review.

### Privacy and data handling
- Store audio recordings and transcripts locally by default.
- Require explicit user consent before uploading session data to cloud.
- Provide one-click session deletion with clear retention defaults (e.g., delete
  after 30 days by default).
- Never train models on user-generated code or audio without explicit permission.

## LLM plans

There are placeholder files for future LLM integration (e.g. Qwen models via
`llama.cpp`). Continue development after the core transcription pipeline is
stable and ensure tests cover this new functionality. SA Round Simulator should
use the same LLM provider abstraction as the main overlay for consistency.
