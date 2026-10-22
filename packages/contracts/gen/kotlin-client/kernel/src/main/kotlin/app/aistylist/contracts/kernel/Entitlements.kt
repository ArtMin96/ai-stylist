// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/entitlements.json
package app.aistylist.contracts.kernel

/** Value kind of an entitlement (planning/12 §3.1). */
enum class EntitlementValueKind(val value: String) {
    BOOLEAN("boolean"),
    LIMIT("limit"),
    LEVEL("level"),
    MAP("map");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): EntitlementValueKind? = entries.firstOrNull { it.value == value }
    }
}

/** Entitlement name (planning/12 §3.1): the only entitlement identifiers. */
enum class EntitlementName(val value: String, val kind: EntitlementValueKind, val description: String, val levels: List<String>) {
    /** Maximum closet items (null = unlimited) */
    CLOSET_MAX_ITEMS("closet.max_items", EntitlementValueKind.LIMIT, "Maximum closet items (null = unlimited)", listOf()),
    /** Recommendations per local day */
    RECS_DAILY_LIMIT("recs.daily_limit", EntitlementValueKind.LIMIT, "Recommendations per local day", listOf()),
    /** Full context richness (hourly weather, holidays, all occasions) */
    RECS_CONTEXT_FULL("recs.context.full", EntitlementValueKind.BOOLEAN, "Full context richness (hourly weather, holidays, all occasions)", listOf()),
    /** Future-day outfit planning */
    RECS_FUTURE_PLANNING("recs.future_planning", EntitlementValueKind.BOOLEAN, "Future-day outfit planning", listOf()),
    /** Avatar ladder level (A1, A1 + all poses) */
    AVATAR_LEVEL("avatar.level", EntitlementValueKind.LEVEL, "Avatar ladder level (A1, A1 + all poses)", listOf("A1", "A1_all_poses")),
    /** Outfit view generation ladder level (G0, G2) */
    TRYON_GENERATIVE("tryon.generative", EntitlementValueKind.LEVEL, "Outfit view generation ladder level (G0, G2)", listOf("G0", "G2")),
    /** Missing-view synthesis */
    VIEWS_MISSING_VIEW("views.missing_view", EntitlementValueKind.BOOLEAN, "Missing-view synthesis", listOf()),
    /** Generative credits granted per month */
    CREDITS_MONTHLY("credits.monthly", EntitlementValueKind.LIMIT, "Generative credits granted per month", listOf()),
    /** Credit top-up packs purchasable */
    CREDITS_TOPUP("credits.topup", EntitlementValueKind.BOOLEAN, "Credit top-up packs purchasable", listOf()),
    /** Versioned credit weights per generative task, carried on the plan */
    CREDITS_WEIGHTS("credits.weights", EntitlementValueKind.MAP, "Versioned credit weights per generative task, carried on the plan", listOf()),
    /** Trends feed level (basic, personalized) */
    TRENDS_LEVEL("trends.level", EntitlementValueKind.LEVEL, "Trends feed level (basic, personalized)", listOf("basic", "personalized")),
    /** Wardrobe analytics */
    ANALYTICS_WARDROBE("analytics.wardrobe", EntitlementValueKind.BOOLEAN, "Wardrobe analytics", listOf()),
    /** Priority queue processing */
    PROCESSING_PRIORITY("processing.priority", EntitlementValueKind.BOOLEAN, "Priority queue processing", listOf()),
    /** Multi-angle exports */
    EXPORT_MULTI_ANGLE("export.multi_angle", EntitlementValueKind.BOOLEAN, "Multi-angle exports", listOf()),
    /** Early-access features */
    FEATURES_EARLY_ACCESS("features.early_access", EntitlementValueKind.BOOLEAN, "Early-access features", listOf()),
    /** Assistant chat (future) */
    CHAT_STYLIST("chat.stylist", EntitlementValueKind.BOOLEAN, "Assistant chat (future)", listOf()),
    /** Personal data export */
    DATA_EXPORT("data.export", EntitlementValueKind.BOOLEAN, "Personal data export", listOf());

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): EntitlementName? = entries.firstOrNull { it.value == value }
    }
}

/** Weighted generative task metered against `credits.monthly` (planning/12 §3.3). */
enum class CreditMeter(val value: String) {
    TRYON("tryon"),
    MISSING_VIEW("missing_view");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): CreditMeter? = entries.firstOrNull { it.value == value }
    }
}
