import com.android.build.api.dsl.CommonExtension
import com.android.build.api.dsl.Lint
import dev.detekt.gradle.extensions.DetektExtension
import dev.detekt.gradle.extensions.FailOnSeverity
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.file.FileCollection
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType
import org.gradle.process.CommandLineArgumentProvider
import org.jetbrains.kotlin.gradle.tasks.KotlinCompilationTask

/** Bytecode level for every module (Android and pure JVM alike). */
internal val JAVA_VERSION: JavaVersion = JavaVersion.VERSION_17

internal val Project.libs: VersionCatalog
    get() = extensions.getByType<VersionCatalogsExtension>().named("libs")

internal fun VersionCatalog.version(alias: String): String = findVersion(alias).get().requiredVersion

internal fun VersionCatalog.library(alias: String) = findLibrary(alias).get()

/**
 * Settings shared by every module: locked dependency graph, warnings as errors, JUnit 4 test
 * logging. Detekt is opt-in per module ([configureDetekt]) so generated code can skip it.
 */
internal fun Project.configureCommonQuality() {
    dependencyLocking {
        lockAllConfigurations()
        lockMode.set(org.gradle.api.artifacts.dsl.LockMode.STRICT)
    }
    configureBuildToolSecurityFloors()
    tasks.withType<KotlinCompilationTask<*>>().configureEach {
        compilerOptions {
            allWarningsAsErrors.set(true)
        }
    }
    tasks.withType<Test>().configureEach {
        testLogging {
            events("failed")
            exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        }
    }
}

/**
 * detekt, limited to what Android Lint + ktlint cannot see: coroutine misuse (swallowed
 * CancellationException, GlobalScope, hard-coded dispatchers), potential bugs, exception
 * handling and complexity. Rules come only from config/detekt.yml (no default config), and
 * any finding fails the build.
 */
internal fun Project.configureDetekt() {
    pluginManager.apply("dev.detekt")
    extensions.configure<DetektExtension> {
        toolVersion.set(libs.version("detekt"))
        buildUponDefaultConfig.set(false)
        config.setFrom(rootProject.file("config/detekt.yml"))
        basePath.set(rootProject.layout.projectDirectory)
        failOnSeverity.set(FailOnSeverity.Info)
        parallel.set(true)
    }
}

/**
 * Android Lint: every warning is an error, and release builds are checked too. No baseline.
 * (HTML/XML/SARIF reports are always written under build/reports/ by AGP 9.)
 */
internal fun Lint.configureStrictLint(project: Project) {
    warningsAsErrors = true
    abortOnError = true
    checkReleaseBuilds = true
    lintConfig = project.rootProject.file("config/lint.xml")
}

/** SDK levels, Java level and test options shared by the application and library modules. */
internal fun Project.configureAndroidCommon(extension: CommonExtension) {
    extension.apply {
        compileSdk = libs.version("sdk-compile").toInt()
        defaultConfig.minSdk = libs.version("sdk-min").toInt()
        compileOptions.sourceCompatibility = JAVA_VERSION
        compileOptions.targetCompatibility = JAVA_VERSION
        testOptions.unitTests.isIncludeAndroidResources = true
        lint.configureStrictLint(this@configureAndroidCommon)
    }
    // Robolectric's Android framework jar comes through Gradle (locked + checksum-verified) and
    // Robolectric runs offline, instead of downloading it from Maven Central at test time.
    val robolectricRuntime =
        configurations.create("robolectricRuntime") {
            isCanBeConsumed = false
            isCanBeResolved = true
            isTransitive = false
        }
    dependencies.add(robolectricRuntime.name, libs.library("robolectric-android-all"))
    tasks.withType<Test>().configureEach {
        // Robolectric (SDK 36 sandbox) reaches into JDK internals; JDK 21 needs this opened.
        jvmArgs("--add-opens=java.base/jdk.internal.access=ALL-UNNAMED")
        jvmArgumentProviders.add(RobolectricOfflineArguments(robolectricRuntime))
    }
}

/** `-Drobolectric.offline=true` pointing at the Gradle-resolved android-all jar. */
internal class RobolectricOfflineArguments(
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.NAME_ONLY)
    val jars: FileCollection,
) : CommandLineArgumentProvider {
    override fun asArguments(): Iterable<String> =
        listOf(
            "-Drobolectric.offline=true",
            "-Drobolectric.dependency.dir=${jars.singleFile.parentFile.absolutePath}",
        )
}

/** Jetpack Compose: compiler plugin, stability config, Slack compose-lint-checks. */
internal fun Project.configureCompose(extension: CommonExtension) {
    pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
    extension.buildFeatures.compose = true
    extensions.configure<org.jetbrains.kotlin.compose.compiler.gradle.ComposeCompilerGradlePluginExtension> {
        stabilityConfigurationFiles.add(rootProject.layout.projectDirectory.file("config/compose-stability.conf"))
    }
    dependencies.add("lintChecks", libs.library("compose-lint-checks"))
}
