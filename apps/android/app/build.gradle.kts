// :app: the Android application. Build types = environments (DECISIONS: debug=dev, preview, release=prod).
//
// API_BASE_URL is HOST-ONLY (scheme://host[:port], no path; the generated client adds /v1).
// Resolution order: Gradle property `aistylist.apiBaseUrl` > env AISTYLIST_API_BASE_URL > the
// per-build-type default below. It is validated at app start by parseAppConfig (:core:data).
//
// PostHog (analytics + error tracking, planning/14 §5; README "Analytics and crash reporting"): the
// keys are never committed. Each one is read from a Gradle property, else from the environment (the
// repo-root .env that `just secrets-sync` writes and direnv loads), else left empty:
//   aistylist.posthogApiKey       / POSTHOG_API_KEY         project key (phc_…), into BuildConfig
//   aistylist.posthogHost         / POSTHOG_HOST            https ingestion host, into BuildConfig
//   aistylist.posthogCliApiKey    / POSTHOG_CLI_API_KEY     personal key for the mapping upload (build only)
//   aistylist.posthogCliProjectId / POSTHOG_CLI_PROJECT_ID  (build only)
//   aistylist.posthogCliHost      / POSTHOG_CLI_HOST        (build only)
// An empty POSTHOG_API_KEY makes AppContainer bind the no-op sink, so no PostHog code runs;
// parseAppConfig (:core:data) validates the key and host at app start.
import com.posthog.android.PostHogCliExecTask

plugins {
    alias(libs.plugins.aistylist.android.application)
    // On the build classpath from the root build script (`apply false`), so no version here.
    id("com.posthog.android")
}

val apiBaseUrlOverride: Provider<String> =
    providers
        .gradleProperty("aistylist.apiBaseUrl")
        .orElse(providers.environmentVariable("AISTYLIST_API_BASE_URL"))

/** A Gradle property, else an environment variable; absent when blank. */
fun buildSetting(
    gradleProperty: String,
    environmentVariable: String,
): Provider<String> =
    providers
        .gradleProperty(gradleProperty)
        .orElse(providers.environmentVariable(environmentVariable))
        .map { it.trim() }
        .filter { it.isNotEmpty() }

val postHogProjectKey: String = buildSetting("aistylist.posthogApiKey", "POSTHOG_API_KEY").getOrElse("")
val postHogIngestionHost: String = buildSetting("aistylist.posthogHost", "POSTHOG_HOST").getOrElse("")

// The key is compiled into the APK, so a personal API key (phx_…, full project access) must never
// get that far: fail the build here. parseAppConfig repeats the check at app start.
if (postHogProjectKey.isNotEmpty() && !postHogProjectKey.startsWith("phc_")) {
    throw GradleException("POSTHOG_API_KEY must be a PostHog project key (phc_…); refusing to build it into the app")
}

/** A Java string literal for a BuildConfig field. */
fun javaString(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

fun apiBaseUrl(default: String): String = javaString(apiBaseUrlOverride.getOrElse(default))

android {
    namespace = "app.aistylist.app"

    defaultConfig {
        applicationId = "app.aistylist.mobile"
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "POSTHOG_API_KEY", javaString(postHogProjectKey))
        buildConfigField("String", "POSTHOG_HOST", javaString(postHogIngestionHost))
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            // dev: Android emulator reaches the host's `just dev-api` (port 3000) via 10.0.2.2.
            applicationIdSuffix = ".dev"
            manifestPlaceholders["appName"] = "AI Stylist Dev"
            buildConfigField("String", "API_BASE_URL", apiBaseUrl("http://10.0.2.2:3000"))
            // Debug tools on Home: the analytics-consent switch and the forced test crash.
            buildConfigField("boolean", "DEBUG_TOOLS", "true")
        }
        release {
            // prod. Unsigned until Play signing lands (the release lane will add a signingConfig).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            manifestPlaceholders["appName"] = "AI Stylist"
            buildConfigField("String", "API_BASE_URL", apiBaseUrl("https://api.ai-stylist.app"))
            // Never in prod: AppContainer injects no crash action, so no debug tools and no forced crash.
            buildConfigField("boolean", "DEBUG_TOOLS", "false")
        }
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".preview"
            manifestPlaceholders["appName"] = "AI Stylist Preview"
            // preview talks to the staging API (OQ-17); keep the iOS Preview configuration in sync.
            buildConfigField("String", "API_BASE_URL", apiBaseUrl("https://staging-api.ai-stylist.app"))
            // The installable MINIFIED build (R8, like release, but debug-signed) with the debug tools:
            // the forced test crash here proves R8 deobfuscation in PostHog (P02 AC-6).
            buildConfigField("boolean", "DEBUG_TOOLS", "true")
            // Installable for internal testing without a release key.
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }
}

// R8 mapping upload. For every minified variant (preview, release) the PostHog plugin injects a
// mapping id into the APK's assets (offline) and runs `posthog-cli exp proguard upload` after
// assemble/install/bundle. The upload runs only when all three CLI settings are present (then
// posthog-cli must be on PATH: mise.toml pins it); otherwise it is skipped, so builds without them
// stay offline and need no posthog-cli.
val postHogCliApiKey = buildSetting("aistylist.posthogCliApiKey", "POSTHOG_CLI_API_KEY")
val postHogCliProjectId = buildSetting("aistylist.posthogCliProjectId", "POSTHOG_CLI_PROJECT_ID")
val postHogCliHost = buildSetting("aistylist.posthogCliHost", "POSTHOG_CLI_HOST")

tasks.withType<PostHogCliExecTask>().configureEach {
    // The task's own inputs; posthog-cli receives them as POSTHOG_CLI_* environment variables.
    postHogApiKey.set(postHogCliApiKey)
    postHogProjectId.set(postHogCliProjectId)
    postHogHost.set(postHogCliHost)
    val cliSettings = listOf(postHogCliApiKey, postHogCliProjectId, postHogCliHost)
    onlyIf("POSTHOG_CLI_API_KEY, POSTHOG_CLI_PROJECT_ID and POSTHOG_CLI_HOST are set") {
        cliSettings.all { it.isPresent }
    }
}

dependencies {
    implementation(project(":feature:home"))
    // Not wired to a screen yet (phase B); the dependency puts :feature:capture under `lintDebug`.
    implementation(project(":feature:capture"))
    implementation(project(":core:data"))
    implementation(project(":core:analytics"))
    implementation(project(":core:designsystem"))
    debugImplementation(project(":core:designsystem-catalog"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    // Only :app sees the SDK: the adapter behind the analytics port lives in the composition root.
    implementation(libs.posthog.android)

    testImplementation(libs.junit4)
}
