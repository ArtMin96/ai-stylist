// :core:analytics: the analytics port + the consent-gated no-op stub. Pure Kotlin, no dependencies.
// Also compiles the GENERATED event taxonomy (packages/contracts/gen/kotlin-client/analytics).
plugins {
    alias(libs.plugins.aistylist.jvm.library)
}

kotlin {
    sourceSets.named("main") {
        kotlin.srcDir(
            rootProject.layout.projectDirectory.dir(
                "../../packages/contracts/gen/kotlin-client/analytics/src/main/kotlin",
            ),
        )
    }
}

dependencies {
    testImplementation(libs.junit4)
}
