import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

/**
 * `aistylist.android.library.compose` — feature modules (`:feature:*`): an Android library with
 * Compose, strict lint + compose-lint-checks, detekt, locking.
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
        }
    }
}
