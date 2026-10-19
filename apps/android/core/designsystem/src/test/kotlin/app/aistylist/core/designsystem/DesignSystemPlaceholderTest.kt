package app.aistylist.core.designsystem

import org.junit.Assert.assertEquals
import org.junit.Test

class DesignSystemPlaceholderTest {
    @Test
    fun `module compiles in the design-system package`() {
        assertEquals("app.aistylist.core.designsystem", DesignSystemPlaceholder::class.java.`package`?.name)
    }
}
