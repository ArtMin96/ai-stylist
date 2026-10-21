// The debug panel over the capture flow (Dev only, capture brief §10 "Debug only" IDs): the lock state and
// the spoken log always show while the harness is in use; the panel button opens the source switch, the
// frame-set picker and the screen-reader flag. Developer UI, not product copy.
#if os(iOS)
  import DesignSystem
  import DesignTokens
  public import SwiftUI

  public struct CaptureDebugPanel: View {
    private let harness: CaptureDebugHarness
    @State private var isExpanded = false
    @Environment(\.appTheme) private var theme

    public init(harness: CaptureDebugHarness) {
      self.harness = harness
    }

    public var body: some View {
      VStack(alignment: .leading, spacing: AppSpacing.space4) {
        Button(isExpanded ? "Debug ▲" : "Debug ▼") { isExpanded.toggle() }
          .font(theme.font(AppTypography.labelSm))
          .frame(minHeight: AppSpacing.space32)
          .accessibilityIdentifier("cap-debug-panel")
        Text(harness.lockState)
          .font(theme.font(AppTypography.caption))
          .accessibilityIdentifier("cap-debug-lock-state")
        if !harness.spokenLog.isEmpty {
          Text(harness.spokenLog.joined(separator: "\n"))
            .font(theme.font(AppTypography.caption))
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("cap-debug-spoken-log")
        }
        if !harness.status.isEmpty {
          Text(harness.status)
            .font(theme.font(AppTypography.caption))
            .fixedSize(horizontal: false, vertical: true)
        }
        if isExpanded {
          controls
        }
      }
      .foregroundStyle(theme.color(.onInverse))
      .padding(AppSpacing.space8)
      .background(RoundedRectangle(cornerRadius: AppRadius.radius12).fill(theme.color(.inverseSurface)))
      .frame(maxWidth: Self.maxWidth, alignment: .leading)
      // Below the camera's top bar (18 + 44 + 14), inside the preview's top-left corner.
      .padding(.top, AppSpacing.space64 + AppSpacing.space16)
      .padding(.leading, AppSpacing.space24)
    }

    /// Debug-only sizes (the panel is not product UI).
    private static let maxWidth = 260.0
    private static let listMaxHeight = 240.0

    private var controls: some View {
      VStack(alignment: .leading, spacing: AppSpacing.space4) {
        HStack(spacing: AppSpacing.space8) {
          sourceButton("Camera", source: .camera, id: "cap-debug-source-camera")
          sourceButton("Frames", source: .frames, id: "cap-debug-source-frames")
        }
        Toggle(
          "Screen reader",
          isOn: Binding(get: { harness.isScreenReaderForced }, set: { harness.setScreenReaderForced($0) })
        )
        .font(theme.font(AppTypography.caption))
        .accessibilityIdentifier("cap-debug-screenreader-toggle")
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 0) {
            ForEach(harness.index?.sets ?? []) { set in
              Button(set.id) {
                harness.selectedSetID = set.id
                harness.source = .frames
              }
              .font(theme.font(set.id == harness.selectedSetID ? AppTypography.captionStrong : AppTypography.caption))
              .frame(minHeight: AppSpacing.space32)
              .accessibilityIdentifier("cap-debug-frameset-\(set.id)")
            }
          }
        }
        .frame(maxHeight: Self.listMaxHeight)
      }
    }

    private func sourceButton(_ title: String, source: CaptureDebugHarness.Source, id: String) -> some View {
      Button(title) { harness.source = source }
        .font(theme.font(harness.source == source ? AppTypography.labelSm : AppTypography.caption))
        .frame(minHeight: AppSpacing.space32)
        .accessibilityAddTraits(harness.source == source ? .isSelected : [])
        .accessibilityIdentifier(id)
    }
  }
#endif
