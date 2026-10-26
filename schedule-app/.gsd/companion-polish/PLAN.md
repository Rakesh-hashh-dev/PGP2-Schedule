# Implementation plan

1. Capture the current roster and inspect per-pet geometry, facial coordinates, animation pivots, wardrobe alignment, and source asset requirements.
2. Refine existing vector artwork in-place: shared expressive eyes and paint definitions, individually placed anatomy/texture/highlights, named connected head/body groups, natural joints and bounded motion.
3. Preserve Luna poses and repair background extraction; retain original source and deterministic pipeline.
4. Refine species timing, coordinated expressions, focus/sleep/care states, hidden/offscreen pausing, and calm static fallbacks.
5. Generate a compact interactive full-roster preview and automated browser QA using the real renderer and CSS; inspect light/dark, small sizes, all moods/actions, continuity, clipping, unique defs, and wardrobe.
6. Run regression tests, targeted ESLint, production build and diff checks. Record evidence and remaining limitations.
