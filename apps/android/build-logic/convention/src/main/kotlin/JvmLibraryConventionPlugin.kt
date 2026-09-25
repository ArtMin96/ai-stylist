import com.android.build.api.dsl.Lint
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension

/**
 * `aistylist.jvm.library` — pure Kotlin/JVM modules (`:core:*`). No Android APIs can be called
 * from here, and tests run on the plain JVM. Android Lint still runs (via `com.android.lint`) so
 * `:app`'s `checkDependencies` lint covers these sources.
 */
class JvmLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            configureKotlinJvm()
            pluginManager.apply("com.android.lint")
            extensions.configure<Lint> { configureStrictLint(target) }
            configureDetekt()
        }
    }
}

/**
 * `aistylist.jvm.generated` — `:core:api-client` only. It compiles committed generator output
 * (packages/contracts/gen/kotlin-client), which is never hand-edited, so lint and detekt do not
 * run on it (the same way ESLint ignores `gen/`). Compiler warnings still fail the build.
 */
class JvmGeneratedLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        target.configureKotlinJvm()
    }
}

private fun Project.configureKotlinJvm() {
    pluginManager.apply("org.jetbrains.kotlin.jvm")
    configureCommonQuality()
    extensions.configure<JavaPluginExtension> {
        sourceCompatibility = JAVA_VERSION
        targetCompatibility = JAVA_VERSION
    }
    extensions.configure<KotlinJvmProjectExtension> {
        compilerOptions.jvmTarget.set(JvmTarget.fromTarget(JAVA_VERSION.toString()))
        // Compile against the JDK 17 API, not the running JDK 21's: these classes run on Android,
        // which has no JDK 21 APIs, and it keeps JDK-21-only deprecations out of the build.
        compilerOptions.freeCompilerArgs.add("-Xjdk-release=${JAVA_VERSION.majorVersion}")
    }
    tasks.withType<JavaCompile>().configureEach {
        options.release.set(JAVA_VERSION.majorVersion.toInt())
    }
}
