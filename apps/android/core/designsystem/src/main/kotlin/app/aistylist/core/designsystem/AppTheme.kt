package app.aistylist.core.designsystem

import android.os.Build
import android.view.accessibility.AccessibilityManager
import androidx.annotation.RequiresApi
import androidx.compose.foundation.isSystemInDarkTheme
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
import app.aistylist.core.designsystem.generated.ButtonSpec

/**
 * One DESIGN.md token context: the generated colours and button looks of one scheme. `brand` (S3)
 * is generated but not selected anywhere yet.
 */
internal enum class AppScheme(
    val colors: AppColors,
    val buttons: ButtonSpec,
    val isDark: Boolean,
) {
    LIGHT(AppColors.light, ButtonSpec.light, isDark = false),
    DARK(AppColors.dark, ButtonSpec.dark, isDark = true),
    HC_LIGHT(AppColors.hcLight, ButtonSpec.hcLight, isDark = false),
    HC_DARK(AppColors.hcDark, ButtonSpec.hcDark, isDark = true),
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

/** The design-system theme: the token context picked from the system settings, plus Material 3. */
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    AppTheme(
        scheme = AppScheme.of(dark = isSystemInDarkTheme(), highContrast = isHighContrastTextEnabled()),
        content = content,
    )
}

/** [AppTheme] with a fixed scheme (previews and tests). */
@Composable
internal fun AppTheme(
    scheme: AppScheme,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalAppScheme provides scheme) {
        // Stock M3 schemes (never dynamic colour) keep the non-button components unchanged until
        // the full M3 mapping lands.
        MaterialTheme(
            colorScheme = if (scheme.isDark) darkColorScheme() else lightColorScheme(),
            content = content,
        )
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
