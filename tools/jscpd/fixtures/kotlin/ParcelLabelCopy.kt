// Clone-check fixture: the copy-and-diverge twin of ParcelLabel.kt. Only the function name
// differs; the body is the copied block the gate must report.
package fixtures.parcel

fun describeReturnParcel(parcel: Parcel): String {
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
