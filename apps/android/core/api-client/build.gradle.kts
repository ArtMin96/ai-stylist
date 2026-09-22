// :core:api-client compiles the GENERATED Kotlin client committed at
// packages/contracts/gen/kotlin-client (tools/codegen/gen-kotlin.sh; `just generate`).
// It has no sources of its own. Only :core:data may depend on it (checkModuleGraph).
plugins {
    alias(libs.plugins.aistylist.jvm.generated)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    sourceSets.named("main") {
        kotlin.srcDir(
            rootProject.layout.projectDirectory.dir("../../packages/contracts/gen/kotlin-client/src/main/kotlin"),
        )
    }
}

dependencies {
    api(libs.retrofit)
    api(libs.okhttp)
    api(libs.kotlinx.serialization.json)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.retrofit.converter.scalars)
    implementation(libs.okhttp.logging.interceptor)
}
