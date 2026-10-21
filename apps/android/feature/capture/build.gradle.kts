// :feature:capture: the guided capture camera (capture brief 2026-10-22). `domain` holds the pure
// rules, lock state machine, timers, hint presenter and flow (no Android types; plain JVM tests);
// CaptureViewModel wires them to a StateFlow. Screens, CameraX and ML Kit come in phase B.
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.feature.capture"
}

dependencies {
    implementation(project(":core:kernel"))

    // Compose (BOM, ui, material3), JUnit 4, Robolectric and Compose ui-test come from the
    // compose-library convention plugin.
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
