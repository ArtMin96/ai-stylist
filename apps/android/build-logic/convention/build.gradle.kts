// Convention plugins: the ONE place compiler, lint, formatting, detekt, locking and test settings
// live. Module build scripts apply one of these ids and declare only their dependencies.
plugins {
    `kotlin-dsl`
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
