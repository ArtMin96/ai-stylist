// :core:designsystem: the app-internal design system (DEC-87, ADR-0011): generated DESIGN.md tokens
// and the base components. It depends on no other project module (checkModuleGraph).
// The generated tokens live in src/main/kotlin/.../generated/ (written by `just generate`, never
// hand-edited). Pure Kotlin until the first real component adds Compose. No module depends on it yet.
plugins {
    alias(libs.plugins.aistylist.jvm.library)
}

dependencies {
    testImplementation(libs.junit4)
}
