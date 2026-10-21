// AppChip: every tappable chip of canvas board C03 (contract .impeccable/components/chip.yaml, DESIGN.md
// "Chips and tags (C03)"). Every look comes from the current theme's ChipSpec; the caller attaches the test
// ID with `.accessibilityIdentifier(_:)`.
public import DesignTokens
public import SwiftUI

/// The app's chip: a SwiftUI `Button` drawn from the C03 tokens of the current `\.appTheme`.
///
/// The state shown follows the contract (G2): disabled, else pressed, else focused, prefixed with the toggle
/// that is on. When the resting state has no look at `variant` × `size` (a size the variant does not take, or
/// a toggle or `enabled: false` it does not take), the chip renders nothing. It is announced by
/// `accessibilityLabel ?? label` in the role of `variant.role`; its icons and parts are hidden inside that one
/// element.
public struct AppChip: View {
  private let label: String
  private let variant: ChipVariant
  private let size: ChipSize
  private let leadingIcon: AppIconName?
  private let selected: Bool
  private let expanded: Bool
  private let enabled: Bool
  private let selection: ChipSelection
  private let prefix: String?
  private let detail: String?
  private let swatch: Color?
  private let accessibilityLabel: String?
  private let action: () -> Void

  @Environment(\.appTheme) private var theme

  /// - Parameters:
  ///   - label: the visible text and, unless `accessibilityLabel` is set, the accessible name; it wraps,
  ///     never truncates.
  ///   - leadingIcon: the caller's C02 glyph, drawn where the look's leading icon comes from the prop; nil
  ///     leaves it out and the chip still renders.
  ///   - selected: true while chosen (choice, swatch, filter, filter-menu); the check shows.
  ///   - expanded: true while the reason row shows (reason).
  ///   - enabled: false shows the disabled look and blocks activation (choice, swatch, filter).
  ///   - selection: a toggle in a multi-select group, or a radio in a one-choice group; read only when
  ///     `variant.role` is `selectable`.
  ///   - prefix: the text before the label ("Group:"; group-sort).
  ///   - detail: the text after the label, behind the separator (the filter count; override).
  ///   - swatch: the garment colour from closet data (swatch).
  ///   - accessibilityLabel: the spoken name when it differs from the label.
  public init(
    _ label: String,
    variant: ChipVariant,
    size: ChipSize,
    leadingIcon: AppIconName? = nil,
    selected: Bool = false,
    expanded: Bool = false,
    enabled: Bool = true,
    selection: ChipSelection = .multiple,
    prefix: String? = nil,
    detail: String? = nil,
    swatch: Color? = nil,
    accessibilityLabel: String? = nil,
    action: @escaping () -> Void
  ) {
    self.label = label
    self.variant = variant
    self.size = size
    self.leadingIcon = leadingIcon
    self.selected = selected
    self.expanded = expanded
    self.enabled = enabled
    self.selection = selection
    self.prefix = prefix
    self.detail = detail
    self.swatch = swatch
    self.accessibilityLabel = accessibilityLabel
    self.action = action
  }

  public var body: some View {
    if AppChipRules.isAllowed(
      variant,
      size,
      selected: selected,
      expanded: expanded,
      enabled: enabled,
      in: theme.chips
    ) {
      Button {
        AppChipRules.activate(enabled: enabled, action: action)
      } label: {
        Text(label)
      }
      .buttonStyle(
        AppChipStyle(
          label: label,
          variant: variant,
          size: size,
          leadingIcon: leadingIcon,
          selected: selected,
          expanded: expanded,
          prefix: prefix,
          detail: detail,
          swatch: swatch
        )
      )
      .disabled(!enabled)
      .focusEffectDisabled()  // AppChipFace draws the C03 focus ring instead of the system halo.
      .accessibilityLabel(accessibilityLabel ?? label)
      .accessibilityAddTraits(roleTraits)
      .accessibilityValue(variant.role == .disclosure ? AppChipRules.disclosureStateText(expanded: expanded) : "")
    }
  }

  /// The traits of `variant.role` beside the button trait the `Button` carries: a multi-select chip is a
  /// toggle; a selectable or menu chip is selected while `selected`. iOS has no public popup trait, so a menu
  /// chip is a button (brief "Intended differences").
  private var roleTraits: AccessibilityTraits {
    let selectedTrait: AccessibilityTraits = selected ? .isSelected : []
    return switch variant.role {
    case .button, .disclosure: []
    case .selectable: selectedTrait.union(selection == .multiple ? .isToggle : [])
    case .menu: selectedTrait
    }
  }
}
