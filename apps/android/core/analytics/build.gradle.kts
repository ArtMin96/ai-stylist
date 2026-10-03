// :core:analytics: the analytics port, the consent gate and the no-op sink. Pure Kotlin, no
// dependencies, no SDK (the PostHog sink lives in :app, the composition root).
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
