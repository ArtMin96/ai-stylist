// :feature:capture: the guided capture camera (capture brief 2026-10-22). `domain` holds the pure
// rules, lock state machine, timers, hint presenter and flow (no Android types; plain JVM tests);
// CaptureViewModel wires them to a StateFlow; `ui` holds the Compose screens and `camera` the
// CameraX + ML Kit observation source. The debug test-frame harness is `:feature:capture-debug`.
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.feature.capture"
    // The live-outline parity fixture both apps test against (tools/capture-frames/parity/README.md).
    sourceSets {
        getByName("test") { resources.directories.add("../../../../tools/capture-frames/parity") }
    }
}

dependencies {
    implementation(project(":core:kernel"))
    implementation(project(":core:designsystem"))

    // Compose (BOM, ui, material3), JUnit 4, Robolectric and Compose ui-test come from the
    // compose-library convention plugin.
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.compose)
    // Bundled models: no Play-services download and no Play-services API call (capture brief C31).
    implementation(libs.mlkit.detection.objects)
    implementation(libs.mlkit.detection.pose)
    // The garment segmenter behind the live outline: LiteRT 1.4.2, CPU (XNNPACK), no Play services
    // and no network (docs/adr/0013-on-device-garment-outline-android.md).
    implementation(libs.litert)
    constraints {
        // ML Kit's POMs ask for okhttp 3.0.0 (and okio 1.6.0 through it), both with known advisories
        // (`just security-scan`); hold them at the catalog's okhttp, which the app already resolves.
        implementation(libs.okhttp)
    }

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.kotlinx.serialization.json)
}
