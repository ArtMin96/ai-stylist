// :feature:capture-debug: the capture camera's debug-only test harness (capture brief 2026-10-22
// §11): a test-frame observation source that plays the `just capture-frames` sets through the same
// analysis path and lock machine, the debug panel, the screen-reader flag and the results log. Only
// `:app` depends on it, as debugImplementation, so no preview or release build contains it.
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.feature.capture.debug"
}

dependencies {
    implementation(project(":feature:capture"))
    implementation(project(":core:data"))
    implementation(project(":core:designsystem"))

    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.mlkit.detection.objects)
    constraints {
        // ML Kit's POMs ask for okhttp 3.0.0 (and okio 1.6.0 through it), both with known advisories
        // (`just security-scan`); hold them at the catalog's okhttp, which the app already resolves.
        implementation(libs.okhttp)
    }

    testImplementation(libs.kotlinx.coroutines.test)
}
