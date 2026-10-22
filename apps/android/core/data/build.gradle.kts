// :core:data: configuration parsing and repositories over the generated API client. Pure Kotlin.
// The generated client is an `implementation` dependency, so its DTOs never reach feature modules.
// Also compiles the GENERATED shared-kernel registries (packages/contracts/gen/kotlin-client/kernel,
// package app.aistylist.contracts.kernel; ADR-0005): unlike the DTOs, these are this module's own
// classes, so every module that depends on :core:data imports them instead of copying a value.
plugins {
    alias(libs.plugins.aistylist.jvm.library)
}

kotlin {
    sourceSets.named("main") {
        kotlin.srcDir(
            rootProject.layout.projectDirectory.dir(
                "../../packages/contracts/gen/kotlin-client/kernel/src/main/kotlin",
            ),
        )
    }
}

dependencies {
    implementation(project(":core:api-client"))
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver3)
}
