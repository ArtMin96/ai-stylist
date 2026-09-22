import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.ProjectDependency
import org.gradle.api.provider.SetProperty
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.withType

/**
 * The module graph, as an allow-list. Every project-to-project dependency (any configuration,
 * tests included) must appear here, or `checkModuleGraph` fails. This is the Android analogue of
 * `just arch-check` (tools/depcruise): features never depend on each other, `core` never depends
 * on `feature`, and only `:core:data` sees the generated API client.
 *
 * Changing this map changes the architecture: do it in its own reviewed commit.
 */
internal val ALLOWED_MODULE_EDGES: Map<String, Set<String>> =
    mapOf(
        ":app" to setOf(":feature:home", ":core:data", ":core:analytics"),
        ":feature:home" to setOf(":core:data", ":core:analytics"),
        ":core:data" to setOf(":core:api-client"),
        ":core:analytics" to emptySet(),
        ":core:api-client" to emptySet(),
    )

/** `aistylist.root` — applied once, to the root project. */
class RootConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        target.tasks.register<CheckModuleGraphTask>("checkModuleGraph") {
            group = "verification"
            description = "Fails when a module depends on a module outside ALLOWED_MODULE_EDGES."
            val root = target
            edges.set(
                target.provider {
                    root.subprojects.flatMapTo(sortedSetOf()) { project ->
                        project.configurations.flatMap { configuration ->
                            configuration.dependencies.withType<ProjectDependency>().map { dependency ->
                                "${project.path} -> ${dependency.path}"
                            }
                        }
                    }
                },
            )
            // Container projects such as `:core` have no build file and hold no code.
            modules.set(
                target.provider {
                    root.subprojects.filter { it.buildFile.exists() }.mapTo(sortedSetOf()) { it.path }
                },
            )
        }
    }
}

abstract class CheckModuleGraphTask : DefaultTask() {
    /** Every observed edge, as "`:from -> :to`". */
    @get:Input
    abstract val edges: SetProperty<String>

    /** Every project path in the build. */
    @get:Input
    abstract val modules: SetProperty<String>

    @TaskAction
    fun check() {
        val problems = mutableListOf<String>()
        modules.get().filter { it !in ALLOWED_MODULE_EDGES }.forEach { module ->
            problems += "module $module is not listed in ALLOWED_MODULE_EDGES (build-logic RootConventionPlugin.kt)"
        }
        edges.get().forEach { edge ->
            val (from, to) = edge.split(" -> ")
            if (from != to && to !in ALLOWED_MODULE_EDGES[from].orEmpty()) {
                problems += "forbidden dependency $edge"
            }
        }
        if (problems.isNotEmpty()) {
            throw GradleException("Module graph check failed:\n" + problems.joinToString("\n") { "  - $it" })
        }
        logger.lifecycle("checkModuleGraph: ${edges.get().size} edges, all allowed")
    }
}
