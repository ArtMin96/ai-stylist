---
paths:
  - "apps/mobile/src/render/**"
  - "assets/3d/**"
---

# Filament boundary and 3D assets

**Skill:** `native-3d-assets`.

**Agent:** `render-3d-engineer`.

**Proof:** `just assets-validate` for anything under `assets/3d/**`; `just test mobile` for render code;
then `just arch-check`.

**Invariants that bite here:**
1. This is the only place Filament types and `.glb`/`.gltf`/`.ktx2` files may be imported outside
   `src/features/avatar/**` — depcruise `render-boundary` (`just arch-check`).
2. Poly/texture budgets, glTF validity, KTX2 encoding, and morph-target naming are gated by
   `just assets-validate` against the manifest schema — not by hand review.
3. Provenance marker + confidence on every generated view, and no "exact digital twin" claim — root
   `CLAUDE.md` honesty invariants; no automated check yet, a reviewer verifies before merge.
