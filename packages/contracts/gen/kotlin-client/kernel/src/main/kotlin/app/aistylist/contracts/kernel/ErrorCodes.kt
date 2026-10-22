// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/error-codes.json
package app.aistylist.contracts.kernel

/** Error code (planning/06 §2): the stable `code` of an RFC 9457 problem the API answers, with its HTTP `status`, its RFC 9457 `title` and its `description` (registry text, not UI copy). A newer server can send a code this build lacks, so a null `fromValue` is a case to handle. */
enum class ErrorCode(val value: String, val status: Int, val title: String, val description: String) {
    /** The request breaks the operation's schema or a field rule; `errors[]` names each failing field by JSON pointer (doc 06 §2). */
    VALIDATION_FAILED("VALIDATION_FAILED", 400, "Request validation failed", "The request breaks the operation's schema or a field rule; `errors[]` names each failing field by JSON pointer (doc 06 §2)."),
    /** The operation's credential is missing or not accepted: the access token (platform.yaml `Unauthenticated`), or the token the operation carries in its body, query or header. */
    UNAUTHENTICATED("UNAUTHENTICATED", 401, "Authentication required", "The operation's credential is missing or not accepted: the access token (platform.yaml `Unauthenticated`), or the token the operation carries in its body, query or header."),
    /** The caller is authenticated but may not perform this operation, including one that needs a recent sign-in (identity.yaml `RecentSignInRequired`); a more specific 403 code wins where the operation names one (platform.yaml `Forbidden`). */
    FORBIDDEN("FORBIDDEN", 403, "Forbidden", "The caller is authenticated but may not perform this operation, including one that needs a recent sign-in (identity.yaml `RecentSignInRequired`); a more specific 403 code wins where the operation names one (platform.yaml `Forbidden`)."),
    /** The resource does not exist for the caller, or the route is unknown. */
    NOT_FOUND("NOT_FOUND", 404, "Not found", "The resource does not exist for the caller, or the route is unknown."),
    /** The request conflicts with the stored state and no more specific 409 code applies; also any repeated `Idempotency-Key` on an operation marked `x-idempotency-replay: never` (platform.yaml `Conflict`). */
    CONFLICT("CONFLICT", 409, "Conflict", "The request conflicts with the stored state and no more specific 409 code applies; also any repeated `Idempotency-Key` on an operation marked `x-idempotency-replay: never` (platform.yaml `Conflict`)."),
    /** Idempotency-Key replayed with a different body (doc 06 §2). */
    IDEMPOTENCY_KEY_REUSED("IDEMPOTENCY_KEY_REUSED", 409, "Idempotency key reused with a different request", "Idempotency-Key replayed with a different body (doc 06 §2)."),
    /** `If-Match` version mismatch; body carries the current state (doc 06 §2). */
    VERSION_MISMATCH("VERSION_MISMATCH", 409, "Resource version mismatch", "`If-Match` version mismatch; body carries the current state (doc 06 §2)."),
    /** `closet.max_items` reached; upsell (doc 12 §3.3). */
    CLOSET_LIMIT_REACHED("CLOSET_LIMIT_REACHED", 409, "Closet item limit reached", "`closet.max_items` reached; upsell (doc 12 §3.3)."),
    /** Feature gated by an entitlement the caller lacks (doc 06 §2, doc 12). */
    ENTITLEMENT_REQUIRED("ENTITLEMENT_REQUIRED", 403, "Entitlement required", "Feature gated by an entitlement the caller lacks (doc 06 §2, doc 12)."),
    /** Signup refused below the minimum age (DEC-60). 403, not 400: the refusal is terminal, so a client must not offer to re-enter the birth year (P03 phase §5). */
    AGE_GATE_FAILED("AGE_GATE_FAILED", 403, "Minimum age not met", "Signup refused below the minimum age (DEC-60). 403, not 400: the refusal is terminal, so a client must not offer to re-enter the birth year (P03 phase §5)."),
    /** Needs a consent purpose the caller has not granted, or refuses the withdrawal of a purpose the person cannot withdraw (`withdrawable: false`; `core_service` today, which the app requires) (doc 11 §7.2); 403 like ENTITLEMENT_REQUIRED. */
    CONSENT_REQUIRED("CONSENT_REQUIRED", 403, "Consent required", "Needs a consent purpose the caller has not granted, or refuses the withdrawal of a purpose the person cannot withdraw (`withdrawable: false`; `core_service` today, which the app requires) (doc 11 §7.2); 403 like ENTITLEMENT_REQUIRED."),
    /** A measurement outside its hard bounds (registry/measurement-definitions.json; doc 07 §3.3 severity 1): refused, not stored. 400 like VALIDATION_FAILED, with `errors[]` naming the field; never echo the value (doc 11 §8). */
    MEASUREMENT_IMPLAUSIBLE("MEASUREMENT_IMPLAUSIBLE", 400, "Measurement outside the accepted range", "A measurement outside its hard bounds (registry/measurement-definitions.json; doc 07 §3.3 severity 1): refused, not stored. 400 like VALIDATION_FAILED, with `errors[]` naming the field; never echo the value (doc 11 §8)."),
    /** Context facts too old to decide on (doc 06 §2). */
    CONTEXT_STALE("CONTEXT_STALE", 409, "Context is stale", "Context facts too old to decide on (doc 06 §2)."),
    /** Account is deleted or deletion is in progress (doc 06 §8). */
    ACCOUNT_DELETED("ACCOUNT_DELETED", 410, "Account deleted", "Account is deleted or deletion is in progress (doc 06 §8)."),
    /** Request body larger than the endpoint accepts (RFC 9110 §15.5.14). */
    CONTENT_TOO_LARGE("CONTENT_TOO_LARGE", 413, "Content too large", "Request body larger than the endpoint accepts (RFC 9110 §15.5.14)."),
    /** Request body `Content-Type` the endpoint does not accept (RFC 9110 §15.5.16). */
    UNSUPPORTED_MEDIA_TYPE("UNSUPPORTED_MEDIA_TYPE", 415, "Unsupported media type", "Request body `Content-Type` the endpoint does not accept (RFC 9110 §15.5.16)."),
    /** A rate limit was hit (doc 11 §14); retry after `Retry-After` seconds (platform.yaml `RateLimited`). */
    RATE_LIMITED("RATE_LIMITED", 429, "Too many requests", "A rate limit was hit (doc 11 §14); retry after `Retry-After` seconds (platform.yaml `RateLimited`)."),
    /** An unexpected server error; the body never carries internals or a provider error body (doc 06 §2). */
    INTERNAL("INTERNAL", 500, "Internal error", "An unexpected server error; the body never carries internals or a provider error body (doc 06 §2)."),
    /** A checked dependency (db, provider) is down; health returns this with `checks` (doc 06 §2). */
    SERVICE_UNAVAILABLE("SERVICE_UNAVAILABLE", 503, "Service unavailable", "A checked dependency (db, provider) is down; health returns this with `checks` (doc 06 §2).");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): ErrorCode? = entries.firstOrNull { it.value == value }
    }
}
