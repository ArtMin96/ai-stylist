# `src/render` — Filament rendering boundary

This directory is the **only** place that may import `react-native-filament` or any Filament
type (engine, scene, material, morph/skeleton handles). Everything outside it — including
`recommendation`-related client code — treats 3D as opaque: it passes renderer-independent
contracts (avatar params, garment representations, outfit compositions from
`@ai-stylist/contracts`) in and gets React components / callbacks out.

Allowed importers: `src/render/**` itself and the designated 3D feature `src/features/avatar/**`.
Enforced by `no-restricted-imports` in `apps/mobile/eslint.config.mjs` (`render-boundary`) and
by dependency-cruiser in T06 (`tools/depcruise/rules.cjs`).

What lives here (later phases): engine/view lifecycle, glTF/KTX2 asset loading, morph-target and
skeletal drivers, camera/gesture controllers, provenance/confidence overlays for generated views.

P02: intentionally empty. `react-native-filament` is **not** a dependency yet; adding it is a
native change (no OTA) and lands with the P01-gated 3D work (planning/05 §2.3, §3).
