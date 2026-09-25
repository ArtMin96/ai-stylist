// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/reason-codes.json
package app.aistylist.contracts.kernel

/** Reason-code namespace (planning/09 §7). */
enum class ReasonCodeNamespace(val value: String) {
    /** hard exclusions (stage 3) */
    EXCL("RC-EXCL"),
    WEATHER("RC-WEATHER"),
    OCCASION("RC-OCCASION"),
    COLOR("RC-COLOR"),
    FIT("RC-FIT"),
    REPEAT("RC-REPEAT"),
    RARELY_WORN("RC-RARELY-WORN"),
    PREF("RC-PREF"),
    TREND("RC-TREND"),
    /** sparse closet */
    GAP("RC-GAP"),
    CTX_MISSING("RC-CTX-MISSING"),
    STALE("RC-STALE");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): ReasonCodeNamespace? = entries.firstOrNull { it.value == value }
    }
}

/** Pipeline stage (planning/09 §2) that may emit a reason code. */
enum class ReasonCodeStage(val value: String) {
    EXCLUSION("exclusion"),
    SCORING("scoring"),
    DIAGNOSTIC("diagnostic");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): ReasonCodeStage? = entries.firstOrNull { it.value == value }
    }
}

/** Recommendation reason code (planning/09 §7): a stable identifier emitted while deciding; explanations are templated from it. */
enum class ReasonCode(val value: String, val namespace: ReasonCodeNamespace, val stage: ReasonCodeStage, val params: List<String>, val description: String) {
    /** Excluded: feels-like temperature is below the safety threshold for this coverage */
    EXCL_COLD_SAFETY("RC-EXCL-COLD-SAFETY", ReasonCodeNamespace.EXCL, ReasonCodeStage.EXCLUSION, listOf("threshold", "feelsLike"), "Excluded: feels-like temperature is below the safety threshold for this coverage");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): ReasonCode? = entries.firstOrNull { it.value == value }
    }
}
