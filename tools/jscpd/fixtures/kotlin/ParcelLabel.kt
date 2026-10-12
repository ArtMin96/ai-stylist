// Clone-check fixture (tools/jscpd/README.md): the body of `describeParcel` is copied into
// ParcelLabelCopy.kt on purpose, so `just clone-check --fixtures` must report a kotlin clone.
package fixtures.parcel

data class Parcel(
    val id: String,
    val weightGrams: Int,
    val lengthMm: Int,
    val widthMm: Int,
    val heightMm: Int,
    val fragile: Boolean,
)

fun describeParcel(parcel: Parcel): String {
    val volumeLitres = parcel.lengthMm.toDouble() * parcel.widthMm * parcel.heightMm / 1_000_000
    val weightKg = parcel.weightGrams / 1000.0
    val density = if (volumeLitres == 0.0) 0.0 else weightKg / volumeLitres
    val size = when {
        volumeLitres > 60 -> "oversize"
        volumeLitres > 20 -> "large"
        else -> "standard"
    }
    val handling = when {
        parcel.fragile -> "fragile"
        density > 2 -> "heavy"
        else -> "normal"
    }
    val parts = mutableListOf(
        "parcel ${parcel.id}",
        "%.2f kg".format(weightKg),
        "%.1f l".format(volumeLitres),
        "size $size",
        "handling $handling",
    )
    if (density > 5) {
        parts.add("check declared weight")
    }
    return parts.joinToString(" | ")
}
