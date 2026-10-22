package app.aistylist.core.data.kernel

import app.aistylist.contracts.kernel.EntitlementName
import app.aistylist.contracts.kernel.EntitlementValueKind
import app.aistylist.contracts.kernel.ErrorCode
import app.aistylist.contracts.kernel.MeasurementId
import app.aistylist.contracts.kernel.StartingShape
import app.aistylist.contracts.kernel.StartingShapes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Asserts invariants of the generated kernel, never a registry value: CLAUDE.md forbids copying
// shared-kernel constants into tests, and the registry JSON is the only place they are pinned.
class GeneratedKernelTest {
    @Test
    fun `every error code round-trips through its wire value`() {
        for (code in ErrorCode.entries) {
            assertEquals(code, ErrorCode.fromValue(code.value))
        }
    }

    @Test
    fun `a code this build lacks maps to null`() {
        assertNull(ErrorCode.fromValue("NOT_A_REGISTERED_CODE"))
    }

    @Test
    fun `every measurement has ordered bounds in its dimension's canonical unit`() {
        for (measurement in MeasurementId.entries) {
            assertEquals(measurement, MeasurementId.fromValue(measurement.value))
            assertTrue(measurement.value, measurement.minimum < measurement.maximum)
            assertEquals(measurement.value, measurement.dimension.canonicalUnit, measurement.unit)
        }
    }

    @Test
    fun `the default starting shape is an offered shape`() {
        assertEquals(StartingShapes.DEFAULT_SHAPE, StartingShape.fromValue(StartingShapes.DEFAULT_SHAPE.value))
        assertTrue(StartingShapes.BASE_MESH.isNotBlank())
    }

    @Test
    fun `only level entitlements carry levels`() {
        for (entitlement in EntitlementName.entries) {
            assertEquals(
                entitlement.value,
                entitlement.kind == EntitlementValueKind.LEVEL,
                entitlement.levels.isNotEmpty(),
            )
        }
    }
}
