import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

/**
 * `aistylist.android.application` — the `:app` module: SDK levels, Compose, strict lint over
 * the whole module graph (`checkDependencies`), detekt, locking. Build types, applicationId and
 * BuildConfig fields stay in app/build.gradle.kts because they are app configuration, not policy.
 */
class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            pluginManager.apply("com.android.application")
            configureCommonQuality()
            configureDetekt()
            extensions.configure<ApplicationExtension> {
                configureAndroidCommon(this)
                configureCompose(this)
                defaultConfig.targetSdk = libs.version("sdk-target").toInt()
                // One lint run on :app covers every module that applies a lint-enabled plugin.
                lint.checkDependencies = true
            }
        }
    }
}
