// :core:designsystem: the app-internal design system (DEC-87, ADR-0011): generated DESIGN.md tokens
// and the base components. It depends on no other project module (checkModuleGraph).
// Scaffold only (AI-188): pure Kotlin until the first real component adds Compose; the generated
// tokens land in src/main/kotlin/.../generated/ (never hand-edited). No module depends on it yet.
plugins {
    alias(libs.plugins.aistylist.jvm.library)
}

dependencies {
    testImplementation(libs.junit4)
}
