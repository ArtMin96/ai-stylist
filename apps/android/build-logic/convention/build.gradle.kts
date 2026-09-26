// Convention plugins: the ONE place compiler, lint, formatting, detekt, locking and test settings
// live. Module build scripts apply one of these ids and declare only their dependencies.
//
// Plain Kotlin JVM + java-gradle-plugin instead of `kotlin-dsl`: `kotlin-dsl` brings the Kotlin
// Gradle plugin version embedded in Gradle (2.4.10 in Gradle 9.8.0), which is affected by
// GHSA-r937-wjx7-w2jp (fixed in 2.4.20). The catalog's Kotlin is used instead. The two things
// `kotlin-dsl` added that these sources rely on are kept: the Gradle Kotlin DSL API
// (`gradleKotlinDsl()`) and SAM-with-receiver for Gradle's `Action<T>` (`this`, not `it`).
buildscript {
    // Lock the plugin classpath too (convention/buildscript-gradle.lockfile).
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

plugins {
    `java-gradle-plugin`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.sam.with.receiver)
}

samWithReceiver {
    annotation("org.gradle.api.HasImplicitReceiver")
}

dependencyLocking {
    lockAllConfigurations()
    lockMode = LockMode.STRICT
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
        allWarningsAsErrors = true
    }
}

dependencies {
    // The Gradle Kotlin DSL extensions (`configure<T>`, `withType<T>`, `register<T>`, …); Gradle
    // provides them at runtime.
    compileOnly(gradleKotlinDsl())
    // compileOnly: the root project puts the real plugins on the build classpath (`apply false`).
    compileOnly(libs.android.gradle.plugin)
    compileOnly(libs.kotlin.gradle.plugin)
    compileOnly(libs.compose.compiler.gradle.plugin)
    compileOnly(libs.detekt.gradle.plugin)
}

gradlePlugin {
    plugins {
        register("root") {
            id = "aistylist.root"
            implementationClass = "RootConventionPlugin"
        }
        register("androidApplication") {
            id = "aistylist.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidLibraryCompose") {
            id = "aistylist.android.library.compose"
            implementationClass = "AndroidLibraryComposeConventionPlugin"
        }
        register("jvmLibrary") {
            id = "aistylist.jvm.library"
            implementationClass = "JvmLibraryConventionPlugin"
        }
        register("jvmGenerated") {
            id = "aistylist.jvm.generated"
            implementationClass = "JvmGeneratedLibraryConventionPlugin"
        }
    }
}
