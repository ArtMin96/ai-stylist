// The token context picked from the system appearance, handed to views as `\.appTheme`. Every value
// comes from the generated DesignTokens (never redeclared here); this file selects the context and
// adapts token types to SwiftUI. The types are `nonisolated`, like the generated token values they
// hold, so the environment key's default value can be read from any isolation.
public import DesignTokens
public import SwiftUI

/// The generated tokens of one DESIGN.md context: S1 light, S2 dark, or S7 high contrast.
nonisolated public struct AppTheme: Sendable, Equatable {
  /// Every colour role, resolved for this context.
  public let colors: AppColors
  /// Every allowed `AppButton` look in this context.
  public let buttons: ButtonSpec
  /// Every allowed `AppChip` look in this context.
  public let chips: ChipSpec
  /// Every allowed `AppTag` look in this context.
  public let tags: TagSpec
  /// Every allowed `AppBadge` look in this context.
  public let badges: BadgeSpec
  /// Every allowed `AppReasonRow` look in this context.
  public let reasonRows: ReasonRowSpec

  public static let light = AppTheme(
    colors: .light,
    buttons: .light,
    chips: .light,
    tags: .light,
    badges: .light,
    reasonRows: .light
  )
  public static let dark = AppTheme(
    colors: .dark,
    buttons: .dark,
    chips: .dark,
    tags: .dark,
    badges: .dark,
    reasonRows: .dark
  )
  public static let highContrastLight = AppTheme(
    colors: .hcLight,
    buttons: .hcLight,
    chips: .hcLight,
    tags: .hcLight,
    badges: .hcLight,
    reasonRows: .hcLight
  )
  public static let highContrastDark = AppTheme(
    colors: .hcDark,
    buttons: .hcDark,
    chips: .hcDark,
    tags: .hcDark,
    badges: .hcDark,
    reasonRows: .hcDark
  )

  /// The type styles (one set for every context).
  public var typography: AppTypography.Type { AppTypography.self }
  /// The spacing scale, in points.
  public var spacing: AppSpacing.Type { AppSpacing.self }
  /// The corner radii, in points.
  public var radius: AppRadius.Type { AppRadius.self }

  /// The context for a system appearance: Increase Contrast selects S7 (`hcLight` / `hcDark`).
  public static func resolved(colorScheme: ColorScheme, contrast: ColorSchemeContrast) -> AppTheme {
    switch (colorScheme, contrast) {
    case (.dark, .increased): .highContrastDark
    case (.dark, _): .dark
    case (_, .increased): .highContrastLight
    default: .light
    }
  }

  /// The SwiftUI colour of `role` in this context.
  public func color(_ role: AppColorRole) -> Color {
    let argb = colors[role]
    return Color(
      .sRGB,
      red: Self.channel(argb, shift: 16),
      green: Self.channel(argb, shift: 8),
      blue: Self.channel(argb, shift: 0),
      opacity: Self.channel(argb, shift: 24)
    )
  }

  /// The bundled font of `style`, scaled with Dynamic Type.
  public func font(_ style: AppTextStyle) -> Font {
    .app(style)
  }

  /// One 8-bit channel of a generated ARGB value (alpha in the top byte), as 0...1.
  private static func channel(_ argb: UInt32, shift: UInt32) -> Double {
    Double((argb >> shift) & 0xFF) / Double(UInt8.max)
  }
}

extension EnvironmentValues {
  /// The token context of this view tree, set by `.appTheme()` at the app root. Light when unset.
  public var appTheme: AppTheme {
    get { self[AppThemeKey.self] }
    set { self[AppThemeKey.self] = newValue }
  }
}

extension View {
  /// Registers the bundled fonts (once per process), sets `\.appTheme` from the system appearance
  /// (light, dark, and Increase Contrast for S7) and the root foreground style to its `text` role.
  /// Apply once, at the app root.
  public func appTheme() -> some View {
    AppFonts.registerOnce()
    return modifier(AppThemeModifier())
  }
}

nonisolated private struct AppThemeKey: EnvironmentKey {
  static let defaultValue = AppTheme.light
}

private struct AppThemeModifier: ViewModifier {
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.colorSchemeContrast) private var contrast

  /// Sets `\.appTheme` and makes the theme's `text` role the root foreground style, so content that
  /// inherits it (an untinted `AppIcon`'s Canvas `.foreground` shading) draws in the token, not the
  /// system `.primary`.
  func body(content: Content) -> some View {
    let theme = AppTheme.resolved(colorScheme: colorScheme, contrast: contrast)
    return
      content
      .environment(\.appTheme, theme)
      .foregroundStyle(theme.color(.text))
  }
}
