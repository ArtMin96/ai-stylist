// Root project: puts every plugin on one classpath (`apply false`), formats the whole tree with
// Spotless, and registers the module-graph check (the Android analogue of `just arch-check`).
// Module build scripts apply the convention plugins from build-logic/ and nothing else.
buildscript {
    // Lock the plugin classpath too (buildscript-gradle.lockfile).
    configurations.classpath {
        resolutionStrategy.activateDependencyLocking()
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.android.lint) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.detekt) apply false
    alias(libs.plugins.spotless)
    id("aistylist.root")
}

dependencyLocking {
    lockAllConfigurations()
    lockMode = LockMode.STRICT
}

// Explicit source globs: never walk build/ output directories (other tasks write there concurrently).
val sourceRoots = listOf("app", "feature/*", "core/*", "build-logic/convention")

spotless {
    val ktlintVersion = libs.versions.ktlint.get()
    kotlin {
        target(*sourceRoots.map { "$it/src/**/*.kt" }.toTypedArray())
        ktlint(ktlintVersion)
    }
    kotlinGradle {
        target(
            *(
                listOf(
                    "*.gradle.kts",
                    "build-logic/*.gradle.kts",
                ) + sourceRoots.map { "$it/*.gradle.kts" }
            ).toTypedArray(),
        )
        ktlint(ktlintVersion)
    }
    format("misc") {
        val misc =
            listOf("*.md", "*.properties", ".editorconfig", ".gitignore", ".gitattributes", "gradle/*.toml", "config/*")
        target(*(misc + sourceRoots.map { "$it/src/**/*.xml" }).toTypedArray())
        trimTrailingWhitespace()
        endWithNewline()
    }
}
