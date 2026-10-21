package app.aistylist.core.designsystem

import android.os.Build
import android.view.accessibility.AccessibilityManager
import androidx.annotation.RequiresApi
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppRadius
import app.aistylist.core.designsystem.generated.AppSpacing
import app.aistylist.core.designsystem.generated.AppTypography
import app.aistylist.core.designsystem.generated.BadgeSpec
import app.aistylist.core.designsystem.generated.ButtonSpec
import app.aistylist.core.designsystem.generated.ChipSpec
import app.aistylist.core.designsystem.generated.ReasonRowSpec
import app.aistylist.core.designsystem.generated.TagSpec

/**
 * One DESIGN.md token context: the generated colours and component looks of one scheme. `brand`
 * (S3) is generated but not selected anywhere yet.
 *
 * For the catalog and snapshot tests only; product UI uses the components and `AppTheme {}`.
 */
enum class AppScheme(
    val colors: AppColors,
    val buttons: ButtonSpec,
    val chips: ChipSpec,
    val tags: TagSpec,
    val badges: BadgeSpec,
    val reasonRows: ReasonRowSpec,
    val isDark: Boolean,
) {
    LIGHT(
        AppColors.light,
        ButtonSpec.light,
        ChipSpec.light,
        TagSpec.light,
        BadgeSpec.light,
        ReasonRowSpec.light,
        isDark = false,
    ),
    DARK(
        AppColors.dark,
        ButtonSpec.dark,
        ChipSpec.dark,
        TagSpec.dark,
        BadgeSpec.dark,
        ReasonRowSpec.dark,
        isDark = true,
    ),
    HC_LIGHT(
        AppColors.hcLight,
        ButtonSpec.hcLight,
        ChipSpec.hcLight,
        TagSpec.hcLight,
        BadgeSpec.hcLight,
        ReasonRowSpec.hcLight,
        isDark = false,
    ),
    HC_DARK(
        AppColors.hcDark,
        ButtonSpec.hcDark,
        ChipSpec.hcDark,
        TagSpec.hcDark,
        BadgeSpec.hcDark,
        ReasonRowSpec.hcDark,
        isDark = true,
    ),
    ;

    companion object {
        /** The scheme for the system settings: high contrast is S7, in its light or dark form. */
        fun of(
            dark: Boolean,
            highContrast: Boolean,
        ): AppScheme =
            when {
                highContrast && dark -> HC_DARK
                highContrast -> HC_LIGHT
                dark -> DARK
                else -> LIGHT
            }
    }
}

// Light by default, like MaterialTheme, so content composed without AppTheme (tests) still resolves.
// The theme's token context is the one implicit dependency the design system is meant to carry
// (AppButton brief §1, as MaterialTheme does); every other value is passed explicitly.
@Suppress("ComposeCompositionLocalUsage") // the AppTheme holder; see the comment above
private val LocalAppScheme = staticCompositionLocalOf { AppScheme.LIGHT }

/**
 * The design-system theme: the token context picked from the system settings, plus Material 3. The
 * content colour is the scheme's `text` role.
 */
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    AppTheme(
        scheme = AppScheme.of(dark = isSystemInDarkTheme(), highContrast = isHighContrastTextEnabled()),
        content = content,
    )
}

/**
 * [AppTheme] with a fixed scheme (catalog previews and tests).
 *
 * For the catalog and snapshot tests only; product UI uses the components and `AppTheme {}`.
 */
@Composable
fun AppTheme(
    scheme: AppScheme,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalAppScheme provides scheme) {
        // Stock M3 schemes (never dynamic colour) keep the non-button components unchanged until
        // the full M3 mapping lands.
        MaterialTheme(colorScheme = if (scheme.isDark) darkColorScheme() else lightColorScheme()) {
            // MaterialTheme sets no content colour, so untinted content outside a Surface would
            // draw Material's default black, which is invisible on the dark schemes.
            CompositionLocalProvider(LocalContentColor provides scheme.colors.color(AppColorRole.TEXT)) {
                content()
            }
        }
    }
}

/** The active token context. Spacing, radius and typography are the same in every context. */
object AppTheme {
    val colors: AppColors
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.colors

    val buttons: ButtonSpec
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.buttons

    val chips: ChipSpec
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.chips

    val tags: TagSpec
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.tags

    val badges: BadgeSpec
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.badges

    val reasonRows: ReasonRowSpec
        @Composable
        @ReadOnlyComposable
        get() = LocalAppScheme.current.reasonRows

    /** The type styles; render one with [toTextStyle] (bundled fonts). */
    val typography: AppTypography get() = AppTypography

    val spacing: AppSpacing get() = AppSpacing

    val radius: AppRadius get() = AppRadius
}

/** The Compose colour of [role] in this context (the generated value is ARGB). */
fun AppColors.color(role: AppColorRole): Color = Color(get(role))

/**
 * Android's public high-contrast-text setting (`AccessibilityManager#isHighContrastTextEnabled`,
 * API 36); off below API 36.
 */
@Composable
private fun isHighContrastTextEnabled(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) highContrastTextState() else false

@RequiresApi(Build.VERSION_CODES.BAKLAVA)
@Composable
private fun highContrastTextState(): Boolean {
    val context = LocalContext.current
    val manager = remember(context) { context.getSystemService(AccessibilityManager::class.java) }
    var enabled by remember(manager) { mutableStateOf(manager?.isHighContrastTextEnabled == true) }
    DisposableEffect(context, manager) {
        val listener = AccessibilityManager.HighContrastTextStateChangeListener { enabled = it }
        manager?.addHighContrastTextStateChangeListener(context.mainExecutor, listener)
        onDispose { manager?.removeHighContrastTextStateChangeListener(listener) }
    }
    return enabled
}
