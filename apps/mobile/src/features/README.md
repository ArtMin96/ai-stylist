# `src/features` — feature modules

One directory per user-facing capability (`closet/`, `outfits/`, `profile/`, `avatar/`, …), each
with its screens, components, hooks and a `tests/` directory (test-placement rule). Routes in
`src/app/` stay thin and delegate here.

Rules (CLAUDE.md, `mobile-feature` skill):

- UI-layer code only: no business rules in components or hooks; decisions come from the API via
  `src/data`.
- `features/avatar/**` is the only feature allowed to import `src/render/**` (render-boundary
  rule, see `src/render/README.md`); everything else treats 3D as opaque.
- Analytics goes through the `Analytics` port in `src/lib/analytics`; adapters are constructed
  only in `src/app/_layout.tsx`.
- `home/` (P02 placeholder): the `/` route's screen and its tests. Tests cannot live under
  `src/app/` because expo-router's `require.context` bundles every file there — another reason
  route files only re-export feature screens.
