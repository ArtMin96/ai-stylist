// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/starting-shapes.json
package app.aistylist.contracts.kernel

/** Avatar starting shape offered at onboarding (planning/07 §3.1), in display order. The entry docs are registry text, not UI copy. */
enum class StartingShape(val value: String) {
    /** Start from the person's own measurements (doc 07 §3.1 "start from my measurements") */
    FROM_MEASUREMENTS("from_measurements"),
    /** Preset labelled by silhouette: broad-shouldered (doc 07 §3.1) */
    BROAD_SHOULDERED("broad_shouldered"),
    /** Preset labelled by silhouette: curvy (doc 07 §3.1) */
    CURVY("curvy"),
    /** Preset labelled by silhouette: straight (doc 07 §3.1) */
    STRAIGHT("straight"),
    /** Preset labelled by silhouette: softer (doc 07 §3.1) */
    SOFTER("softer");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): StartingShape? = entries.firstOrNull { it.value == value }
    }
}

/** Starting-shape constants (planning/07 §3.1). */
object StartingShapes {
    /** The shape preselected when the person makes no choice. */
    val DEFAULT_SHAPE: StartingShape = StartingShape.FROM_MEASUREMENTS

    /** Base mesh id every starting shape starts from. */
    const val BASE_MESH: String = "anny-adult-v1"
}
