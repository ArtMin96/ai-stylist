package app.aistylist.core.data.model

/** Build identity of the running API. Our own type: the generated DTO never leaves `:core:data`. */
data class ApiVersion(
    val version: String,
    val commit: String,
) {
    /** First 7 characters of the commit SHA, as shown on the home screen. */
    val shortCommit: String get() = commit.take(SHORT_COMMIT_LENGTH)

    private companion object {
        const val SHORT_COMMIT_LENGTH = 7
    }
}

/** Outcome of `GET /v1/version`. Never an exception: the screen renders every case. */
sealed interface VersionResult {
    data class Success(
        val version: ApiVersion,
    ) : VersionResult

    data class Failure(
        val reason: FailureReason,
    ) : VersionResult
}

/** Why a request failed, without user-facing text (the UI owns the strings). */
sealed interface FailureReason {
    /** No HTTP response at all: connection refused, timeout, DNS, TLS. */
    data object Unreachable : FailureReason

    /** RFC 9457 problem response; [title] is the server's human-readable summary. */
    data class Problem(
        val status: Int,
        val title: String,
    ) : FailureReason

    /** Non-2xx response without a parseable problem body. */
    data class HttpStatus(
        val status: Int,
    ) : FailureReason

    /** 2xx response whose body did not match the contract. */
    data object InvalidResponse : FailureReason
}
