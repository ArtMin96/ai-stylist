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

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
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
