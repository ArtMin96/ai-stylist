// :core:data: configuration parsing and repositories over the generated API client. Pure Kotlin.
// The generated client is an `implementation` dependency, so its DTOs never reach feature modules.
plugins {
    alias(libs.plugins.aistylist.jvm.library)
}

dependencies {
    implementation(project(":core:api-client"))
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver3)
}
