// :app: the Android application. Build types = environments (DECISIONS: debug=dev, preview, release=prod).
//
// API_BASE_URL is HOST-ONLY (scheme://host[:port], no path; the generated client adds /v1).
// Resolution order: Gradle property `aistylist.apiBaseUrl` > env AISTYLIST_API_BASE_URL > the
// per-build-type default below. It is validated at app start by parseAppConfig (:core:data).
plugins {
    alias(libs.plugins.aistylist.android.application)
}

val apiBaseUrlOverride: Provider<String> =
    providers
        .gradleProperty("aistylist.apiBaseUrl")
        .orElse(providers.environmentVariable("AISTYLIST_API_BASE_URL"))

fun apiBaseUrl(default: String): String = "\"${apiBaseUrlOverride.getOrElse(default)}\""

android {
    namespace = "app.aistylist.app"

    defaultConfig {
        applicationId = "app.aistylist.mobile"
        versionCode = 1
        versionName = "0.1.0"
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
        }
        release {
            // prod. Unsigned until Play signing lands (the release lane will add a signingConfig).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            manifestPlaceholders["appName"] = "AI Stylist"
            buildConfigField("String", "API_BASE_URL", apiBaseUrl("https://api.ai-stylist.app"))
        }
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".preview"
            manifestPlaceholders["appName"] = "AI Stylist Preview"
            // preview talks to the staging API (OQ-17); keep the iOS Preview configuration in sync.
            buildConfigField("String", "API_BASE_URL", apiBaseUrl("https://staging-api.ai-stylist.app"))
            // Installable for internal testing without a release key.
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }
}

dependencies {
    implementation(project(":feature:home"))
    implementation(project(":core:data"))
    implementation(project(":core:analytics"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    testImplementation(libs.junit4)
}
