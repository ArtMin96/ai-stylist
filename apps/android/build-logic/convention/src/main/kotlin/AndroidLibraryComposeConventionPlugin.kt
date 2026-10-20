import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

/**
 * `aistylist.android.library.compose` — Compose library modules (`:feature:*` and the design
 * system with its catalog): an Android library with Compose (BOM, ui, material3), strict lint +
 * compose-lint-checks, detekt, locking, and the Compose + Robolectric test setup.
 */
class AndroidLibraryComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.library")
            configureCommonQuality()
            configureDetekt()
            extensions.configure<LibraryExtension> {
                configureAndroidCommon(this)
                configureCompose(this)
                // `preview` must exist in every module the app depends on.
                buildTypes.create("preview") { initWith(buildTypes.getByName("release")) }
            }
            configureComposeDependencies()
        }
    }
}

/** The Compose libraries every module uses, and the JVM UI tests: JUnit 4, Robolectric, Compose test rule. */
private fun Project.configureComposeDependencies() {
    dependencies.apply {
        add("implementation", platform(libs.library("androidx-compose-bom")))
        add("implementation", libs.library("androidx-compose-ui"))
        add("implementation", libs.library("androidx-compose-material3"))

        add("testImplementation", libs.library("junit4"))
        add("testImplementation", libs.library("robolectric"))
        add("testImplementation", platform(libs.library("androidx-compose-bom")))
        add("testImplementation", libs.library("androidx-compose-ui-test-junit4"))
        // The test activity createComposeRule() launches.
        add("debugImplementation", libs.library("androidx-compose-ui-test-manifest"))
        // Compose ui-test pulls in Espresso 3.5.0, whose reflective InputManager.getInstance()
        // fails in the Robolectric SDK 37 sandbox; 3.7.0 uses getSystemService instead.
        constraints.add("testImplementation", libs.library("androidx-test-espresso-core"))
    }
}
