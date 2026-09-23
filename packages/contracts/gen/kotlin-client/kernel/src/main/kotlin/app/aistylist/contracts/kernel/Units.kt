// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/units.json
package app.aistylist.contracts.kernel

/** Canonical length unit(s) (planning/06 §2): the API stores and returns SI. */
enum class LengthUnit(val value: String) {
    CM("cm");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): LengthUnit? = entries.firstOrNull { it.value == value }
    }
}

/** Canonical mass unit(s) (planning/06 §2): the API stores and returns SI. */
enum class MassUnit(val value: String) {
    KG("kg");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): MassUnit? = entries.firstOrNull { it.value == value }
    }
}

/** Canonical temperature unit(s) (planning/06 §2): the API stores and returns SI. */
enum class TemperatureUnit(val value: String) {
    CELSIUS("celsius");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): TemperatureUnit? = entries.firstOrNull { it.value == value }
    }
}

/** Measurement dimension (TS `Dimension`). */
enum class MeasurementDimension(val value: String, val canonicalUnit: String) {
    LENGTH("length", "cm"),
    MASS("mass", "kg"),
    TEMPERATURE("temperature", "celsius");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): MeasurementDimension? = entries.firstOrNull { it.value == value }
    }
}

/** Canonical (stored) unit per dimension. */
object CanonicalUnits {
    val LENGTH: LengthUnit = LengthUnit.CM
    val MASS: MassUnit = MassUnit.KG
    val TEMPERATURE: TemperatureUnit = TemperatureUnit.CELSIUS
}

/** Display unit system selectable in the profile (planning/06 §3.1 `locale.unitSystem`). */
enum class UnitSystem(val value: String) {
    METRIC("metric"),
    IMPERIAL("imperial");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): UnitSystem? = entries.firstOrNull { it.value == value }
    }
}

/** Who produced a measurement value (planning/06 §3.1): estimated/derived values must carry confidence. */
enum class MeasurementSource(val value: String) {
    USER("user"),
    ESTIMATED("estimated"),
    DERIVED("derived");

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): MeasurementSource? = entries.firstOrNull { it.value == value }
    }
}

/** Exact display-conversion factors (planning/06 §3.1); storage stays SI. */
object ConversionFactors {
    const val CM_PER_INCH: Double = 2.54
    const val KG_PER_POUND: Double = 0.45359237
}
