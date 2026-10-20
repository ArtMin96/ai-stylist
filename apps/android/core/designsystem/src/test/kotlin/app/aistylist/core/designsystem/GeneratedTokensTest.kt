package app.aistylist.core.designsystem

import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.BannerDarkTokens
import org.junit.Assert.assertNotEquals
import org.junit.Test

class GeneratedTokensTest {
    private val schemes =
        mapOf(
            "light" to AppColors.light,
            "dark" to AppColors.dark,
            "brand" to AppColors.brand,
            "hcLight" to AppColors.hcLight,
            "hcDark" to AppColors.hcDark,
        )

    @Test
    fun `light and dark schemes resolve different background and text`() {
        listOf(AppColorRole.BACKGROUND, AppColorRole.TEXT).forEach { role ->
            assertNotEquals("$role", AppColors.light[role], AppColors.dark[role])
        }
    }

    @Test
    fun `every scheme separates text from background`() {
        schemes.forEach { (name, scheme) ->
            assertNotEquals(name, scheme[AppColorRole.BACKGROUND], scheme[AppColorRole.TEXT])
        }
    }

    @Test
    fun `dark banner text and background resolve to different dark colours`() {
        val banner = BannerDarkTokens.dark
        assertNotEquals(AppColors.dark[banner.backgroundColor], AppColors.dark[banner.textColor])
    }
}
