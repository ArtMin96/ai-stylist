// :core:designsystem-catalog: the dev-only design-system catalog (owner, 2026-10-20): the component
// previews and the debug gallery (AI-195). Only `:app` depends on it, as debugImplementation, so no
// preview, release or production build contains it. It depends on :core:designsystem only.
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.core.designsystem.catalog"
}

dependencies {
    implementation(project(":core:designsystem"))
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
