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
enum class EntitlementName(val value: String, val kind: EntitlementValueKind, val description: String) {
    /** Maximum closet items (null = unlimited) */
    CLOSET_MAX_ITEMS("closet.max_items", EntitlementValueKind.LIMIT, "Maximum closet items (null = unlimited)"),
    /** Recommendations per local day */
    RECS_DAILY_LIMIT("recs.daily_limit", EntitlementValueKind.LIMIT, "Recommendations per local day"),
    /** Full context richness (hourly weather, holidays, all occasions) */
    RECS_CONTEXT_FULL("recs.context.full", EntitlementValueKind.BOOLEAN, "Full context richness (hourly weather, holidays, all occasions)"),
    /** Future-day outfit planning */
    RECS_FUTURE_PLANNING("recs.future_planning", EntitlementValueKind.BOOLEAN, "Future-day outfit planning"),
    /** Avatar ladder level (A1, A1 + all poses) */
    AVATAR_LEVEL("avatar.level", EntitlementValueKind.LEVEL, "Avatar ladder level (A1, A1 + all poses)"),
    /** Outfit view generation ladder level (G0, G2) */
    TRYON_GENERATIVE("tryon.generative", EntitlementValueKind.LEVEL, "Outfit view generation ladder level (G0, G2)"),
    /** Missing-view synthesis */
    VIEWS_MISSING_VIEW("views.missing_view", EntitlementValueKind.BOOLEAN, "Missing-view synthesis"),
    /** Generative credits granted per month */
    CREDITS_MONTHLY("credits.monthly", EntitlementValueKind.LIMIT, "Generative credits granted per month"),
    /** Credit top-up packs purchasable */
    CREDITS_TOPUP("credits.topup", EntitlementValueKind.BOOLEAN, "Credit top-up packs purchasable"),
    /** Versioned credit weights per generative task, carried on the plan */
    CREDITS_WEIGHTS("credits.weights", EntitlementValueKind.MAP, "Versioned credit weights per generative task, carried on the plan"),
    /** Trends feed level (basic, personalized) */
    TRENDS_LEVEL("trends.level", EntitlementValueKind.LEVEL, "Trends feed level (basic, personalized)"),
    /** Wardrobe analytics */
    ANALYTICS_WARDROBE("analytics.wardrobe", EntitlementValueKind.BOOLEAN, "Wardrobe analytics"),
    /** Priority queue processing */
    PROCESSING_PRIORITY("processing.priority", EntitlementValueKind.BOOLEAN, "Priority queue processing"),
    /** Multi-angle exports */
    EXPORT_MULTI_ANGLE("export.multi_angle", EntitlementValueKind.BOOLEAN, "Multi-angle exports"),
    /** Early-access features */
    FEATURES_EARLY_ACCESS("features.early_access", EntitlementValueKind.BOOLEAN, "Early-access features"),
    /** Assistant chat (future) */
    CHAT_STYLIST("chat.stylist", EntitlementValueKind.BOOLEAN, "Assistant chat (future)"),
    /** Personal data export */
    DATA_EXPORT("data.export", EntitlementValueKind.BOOLEAN, "Personal data export");

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
