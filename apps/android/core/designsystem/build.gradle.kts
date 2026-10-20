// :core:designsystem: the app-internal design system (DEC-87, ADR-0011): generated DESIGN.md tokens,
// the bundled fonts, AppTheme and the base components (AppButton). It depends on no other project
// module (checkModuleGraph). The generated tokens live in src/main/kotlin/.../generated/ (written by
// `just generate`, never hand-edited).
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.core.designsystem"
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit4)
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    constraints {
        // Compose ui-test pulls in Espresso 3.5.0, whose reflective InputManager.getInstance()
        // fails in the Robolectric SDK 37 sandbox; 3.7.0 uses getSystemService instead.
        testImplementation(libs.androidx.test.espresso.core)
    }
}
