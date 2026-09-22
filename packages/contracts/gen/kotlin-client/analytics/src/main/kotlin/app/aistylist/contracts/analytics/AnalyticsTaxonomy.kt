// GENERATED — run `just generate` (tools/codegen/gen-kotlin.sh). DO NOT EDIT BY HAND.
// Source: packages/contracts/events/analytics/events.json
package app.aistylist.contracts.analytics

/** Product-analytics event taxonomy, version 1. Names only; payload types in KDoc. */
object AnalyticsTaxonomy {
    /** The mobile app came to the foreground. Owner: platform. */
    object AppOpened {
        const val NAME: String = "app_opened"
        const val CONSENT_REQUIRED: Boolean = true

        /** Property `platform`: string. */
        const val PLATFORM: String = "platform"

        /** Property `appVersion`: string. */
        const val APP_VERSION: String = "appVersion"

        /** Property `coldStart`: boolean. */
        const val COLD_START: String = "coldStart"
    }
}
