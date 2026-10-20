// :core:designsystem-catalog: the dev-only design-system catalog (owner, 2026-10-20): the component
// previews and the debug gallery (AI-195). Only `:app` depends on it, as debugImplementation, so no
// preview, release or production build contains it. It depends on :core:designsystem only. Compose
// and the Robolectric test setup come from the compose-library convention plugin.
plugins {
    alias(libs.plugins.aistylist.android.library.compose)
}

android {
    namespace = "app.aistylist.core.designsystem.catalog"
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
