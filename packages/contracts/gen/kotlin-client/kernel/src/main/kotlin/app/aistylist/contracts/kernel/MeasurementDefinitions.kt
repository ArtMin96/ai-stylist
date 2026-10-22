// GENERATED — run `just generate` (tools/codegen/gen-kernel.mjs). DO NOT EDIT BY HAND.
// Source: packages/shared-kernel/registry/measurement-definitions.json
package app.aistylist.contracts.kernel

/** Body measurement (planning/07 §3.3) with its `dimension`, the raw value of its stored `unit` (the canonical unit of the dimension) and its hard bounds `minimum` and `maximum` in that unit (registry `min` and `max`; the names match Swift, where `min` would shadow `min(_:_:)`). Both bounds are inclusive: a value equal to one is accepted. Outside them the API answers `MEASUREMENT_IMPLAUSIBLE` and never stores or clamps the value. */
enum class MeasurementId(val value: String, val dimension: MeasurementDimension, val unit: String, val minimum: Double, val maximum: Double) {
    HEIGHT("height", MeasurementDimension.LENGTH, "cm", 120.0, 230.0),
    WEIGHT("weight", MeasurementDimension.MASS, "kg", 30.0, 300.0),
    CHEST("chest", MeasurementDimension.LENGTH, "cm", 60.0, 200.0),
    WAIST("waist", MeasurementDimension.LENGTH, "cm", 45.0, 200.0),
    HIPS("hips", MeasurementDimension.LENGTH, "cm", 55.0, 200.0),
    INSEAM("inseam", MeasurementDimension.LENGTH, "cm", 40.0, 120.0),
    SHOULDER("shoulder", MeasurementDimension.LENGTH, "cm", 25.0, 70.0),
    SLEEVE("sleeve", MeasurementDimension.LENGTH, "cm", 40.0, 100.0),
    THIGH("thigh", MeasurementDimension.LENGTH, "cm", 30.0, 120.0),
    NECK("neck", MeasurementDimension.LENGTH, "cm", 25.0, 70.0);

    companion object {
        /** The entry whose wire value is [value], or null. */
        fun fromValue(value: String): MeasurementId? = entries.firstOrNull { it.value == value }
    }
}
