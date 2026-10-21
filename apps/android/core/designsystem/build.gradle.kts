// :core:designsystem: the app-internal design system (DEC-87, ADR-0011): generated DESIGN.md tokens,
// the bundled fonts, AppTheme and the base components (AppButton, AppIcon, AppChip, AppTag, AppBadge,
// AppReasonRow). It depends on no other project module (checkModuleGraph). The generated tokens live
// in src/main/kotlin/.../generated/ (written by `just generate`, never hand-edited).
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.core.designsystem"
}

// Compose (BOM, ui, material3) and the JUnit 4 + Robolectric + Compose ui-test setup come from the
// compose-library convention plugin. No preview tooling here: previews live in
// :core:designsystem-catalog (owner, 2026-10-20).
