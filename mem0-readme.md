# Mem0 Integration Notes

This document tracks the design and implementation of the Mem0-based long-term memory layer for Grokchat.

## Goals

- Add durable, per-user memory for preferences, profile, goals, and category summaries.
- Keep the React UI unchanged apart from pointing it to a backend `/api/chat` endpoint.
- Encapsulate Mem0 usage behind a thin `memoryProvider` abstraction.

## Current Status

- [x] Added Node/Express backend scaffolding in `server/index.ts`.
- [x] Implemented `server/memoryProvider.ts` using the Node Mem0 SDK with `saveUserMemories` and `getRelevantMemories`.
- [x] Exposed `/api/chat` as a pure memory endpoint that:
  - Extracts simple preference/profile/goal memories from the latest user message.
  - Writes them to Mem0.
  - Returns `usedMemories` (no Grok call here).
- [x] Wired `App.tsx` to call `/api/chat` and inject `usedMemories` into the Grok system prompt before calling Grok.
- [ ] Add a few scripted demo flows for judging.

## Next steps

- Design 2–3 **demo flows** that clearly showcase memory:
  - Preference: user says "I prefer short, bullet-point answers" → later responses are brief and can mention this preference.
  - Profile: user says "I'm a backend engineer on Windows using VS Code" → later responses reference this persona.
  - Goal: user says "We're working on shipping Grokchat for a hackathon" → later reminders and suggestions reflect this goal.
- Optionally refine the context filter heuristics in `server/index.ts` to:
  - Handle more phrasings ("my preference is", "I usually like", etc.).
  - Add basic category summaries using Grok to compress per-tag history into `category_summary` memories.
