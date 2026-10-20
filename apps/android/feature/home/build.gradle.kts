// :feature:home: the placeholder home screen (P02 parity with the retired React Native app).
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.feature.home"
}

dependencies {
    implementation(project(":core:data"))
    implementation(project(":core:analytics"))
    implementation(project(":core:designsystem"))

    // Compose (BOM, ui, material3), JUnit 4, Robolectric and Compose ui-test come from the
    // compose-library convention plugin.
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
