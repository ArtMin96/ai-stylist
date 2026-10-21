// What one gallery section shows (AI-195): a token category or a component's cells, each with its
// generated items in generated order. Pure data, so the tests check it without rendering.
package import DesignTokens

/// The kind of a gallery section and the items it renders.
nonisolated package enum GallerySectionKind: Equatable, Sendable {
  case colours([AppColorRole])
  case typography([AppTextStyle])
  case spacing([AppScaleStep])
  case radius([AppScaleStep])
  case buttons([ButtonGalleryEntry])
  case icons([AppIconName])
  case badges([BadgeGalleryEntry])
  case chips([ChipGalleryEntry])
  case reasonRows([ReasonRowGalleryEntry])
  case tags([TagGalleryEntry])

  /// The label of each item, in order: role ids, style and step names, component and icon test ids.
  package var itemLabels: [String] {
    switch self {
    case .colours(let roles): roles.map(\.rawValue)
    case .typography(let styles): styles.map(\.name)
    case .spacing(let steps), .radius(let steps): steps.map(\.name)
    case .buttons(let entries): entries.map(\.testId)
    case .icons(let names): names.map(\.testId)
    case .badges(let entries): entries.map(\.testId)
    case .chips(let entries): entries.map(\.testId)
    case .reasonRows(let entries): entries.map(\.testId)
    case .tags(let entries): entries.map(\.testId)
    }
  }
}
