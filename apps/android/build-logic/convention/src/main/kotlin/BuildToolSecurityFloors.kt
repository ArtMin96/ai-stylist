import org.gradle.api.Project
import org.gradle.api.artifacts.CacheableRule
import org.gradle.api.artifacts.ComponentMetadataContext
import org.gradle.api.artifacts.ComponentMetadataRule
import org.gradle.api.artifacts.Configuration
import org.gradle.kotlin.dsl.withModule
import javax.inject.Inject

/**
 * Upgrade-only dependency constraints ("security floors") on the configurations that resolve
 * BUILD TOOLS, never the app's runtime classpath: Android Lint (`androidLintTool`) and the
 * Unified Test Platform (`unified-test-platform-*`). Those tools pull patched-upstream
 * libraries (netty, Bouncy Castle, commons-lang3, httpclient) at versions with published
 * advisories; each floor is the first patch release that fixes them, within the same major line.
 *
 * Versions live in gradle/libs.versions.toml (`floor-*`). The root build script applies the same
 * floors to the plugin classpath; [configureKtlintLogbackFloor] covers Spotless's ktlint.
 * Remove a floor once the owning tool ships the fixed version itself.
 */
internal fun Project.configureBuildToolSecurityFloors() {
    configurations.configureEach {
        when {
            name == "androidLintTool" -> addFloors(this, JVM_TOOL_FLOORS, withNetty = false)
            name.startsWith("unified-test-platform") -> addFloors(this, JVM_TOOL_FLOORS, withNetty = true)
        }
    }
}

private val JVM_TOOL_FLOORS =
    listOf("floor-bcprov", "floor-bcpkix", "floor-bcutil", "floor-commons-lang3", "floor-httpclient")

private fun Project.addFloors(
    configuration: Configuration,
    aliases: List<String>,
    withNetty: Boolean,
) {
    configuration.withDependencies {
        aliases.forEach { alias ->
            configuration.dependencyConstraints.add(
                project.dependencies.constraints.create(libs.library(alias).get()) {
                    because("security floor for a build tool; see docs/security/dependency-ignores.md")
                },
            )
        }
        if (withNetty) {
            // The BOM only constrains netty modules the tool already uses; it adds none.
            add(project.dependencies.platform(libs.library("floor-netty-bom").get()))
        }
    }
}

/**
 * ktlint-cli (resolved by Spotless in a detached configuration, which dependency constraints
 * cannot reach) declares logback-classic 1.3.16. Raise that declared version to the patched
 * `floor-logback` through a component metadata rule on ktlint-cli only. Root project only.
 */
internal fun Project.configureKtlintLogbackFloor() {
    dependencies.components.withModule<KtlintLogbackFloorRule>("com.pinterest.ktlint:ktlint-cli") {
        params(libs.version("floor-logback"))
    }
}

@CacheableRule
abstract class KtlintLogbackFloorRule
    @Inject
    constructor(
        private val logbackVersion: String,
    ) : ComponentMetadataRule {
        override fun execute(context: ComponentMetadataContext) {
            context.details.allVariants {
                withDependencies {
                    filter { it.group == "ch.qos.logback" }.forEach { dependency ->
                        dependency.version { require(logbackVersion) }
                        dependency.because(
                            "security floor for Spotless's ktlint; see docs/security/dependency-ignores.md",
                        )
                    }
                }
            }
        }
    }
