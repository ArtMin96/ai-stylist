// The screens after a photo (capture brief §7, board SC19–SC20): review with the back or pair question
// (`cap-screen-review`), library import (the system picker, one photo) and its tips
// (`cap-screen-import-tips`), and the batch summary (`cap-screen-batch-summary`). Photos come from the
// flow's in-memory store.
#if os(iOS)
  import AIStylistKernel
  import CaptureModel
  import DesignSystem
  import DesignTokens
  import PhotosUI
  import SwiftUI
  import UIKit

  /// `cap-screen-review`: the photo, "Is the back different?" (shoes: "Add a photo of the pair?"), then
  /// Done or the second photo, and Retake.
  struct CaptureReviewView: View {
    let model: CaptureModel
    let review: CaptureReview
    let photos: CapturePhotoStore
    @Environment(\.appTheme) private var theme

    private var isPair: Bool { review.question == .addPairPhoto }

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.review.title"),
          closeID: "cap-review-close",
          onClose: model.close
        )
        ScrollView {
          VStack(alignment: .leading, spacing: AppSpacing.space24) {
            if let second = review.second {
              HStack(alignment: .top, spacing: CaptureMetrics.pickerColumnGap) {
                labelledPhoto(review.front, labelKey: "capture.review.photo.front", id: "cap-review-photo-front")
                labelledPhoto(
                  second,
                  labelKey: isPair ? "capture.review.photo.pair" : "capture.review.photo.back",
                  id: "cap-review-photo-back"
                )
              }
            } else {
              CapturePhotoTile(
                image: photos.images[review.front],
                label: CaptureText.localized("capture.review.photo.front"),
                height: CaptureMetrics.reviewPhotoHeight,
                cornerRadius: AppRadius.radius24
              )
              .accessibilityIdentifier("cap-review-photo-front")
              question
            }
          }
          .padding(AppSpacing.space20)
        }
        actions
      }
      .background(theme.color(.background).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-screen-review")
    }

    /// One of the two photos side by side (SC19 "both"): 220 high, radius 16, its name below.
    private func labelledPhoto(_ id: CapturePhotoID, labelKey: String, id testID: String) -> some View {
      let label = CaptureText.localized(labelKey)
      return VStack(alignment: .leading, spacing: AppSpacing.space4) {
        CapturePhotoTile(
          image: photos.images[id],
          label: label,
          height: CaptureMetrics.reviewPairPhotoHeight,
          cornerRadius: AppRadius.radius16
        )
        .accessibilityIdentifier(testID)
        Text(label)
          .font(theme.font(AppTypography.labelSm))
          .foregroundStyle(theme.color(.text))
          .accessibilityHidden(true)
      }
    }

    private var question: some View {
      VStack(alignment: .leading, spacing: AppSpacing.space12) {
        Text(CaptureText.localized(isPair ? "capture.review.question.pair" : "capture.review.question.back"))
          .font(theme.font(AppTypography.headline))
          .foregroundStyle(theme.color(.text))
          .accessibilityAddTraits(.isHeader)
        HStack(spacing: AppSpacing.space8) {
          AppChip(
            CaptureText.localized(isPair ? "capture.review.no" : "capture.review.same"),
            variant: .choice,
            size: .large,
            selected: !review.wantsSecondPhoto,
            selection: .single
          ) { model.answerSecondPhoto(wanted: false) }
          .accessibilityIdentifier("cap-review-back-same")
          AppChip(
            CaptureText.localized(isPair ? "capture.review.yes" : "capture.review.different"),
            variant: .choice,
            size: .large,
            selected: review.wantsSecondPhoto,
            selection: .single
          ) { model.answerSecondPhoto(wanted: true) }
          .accessibilityIdentifier("cap-review-back-different")
        }
      }
    }

    private var actions: some View {
      VStack(spacing: CaptureMetrics.sheetActionGap) {
        if review.wantsSecondPhoto, review.second == nil {
          AppButton(
            CaptureText.localized(isPair ? "capture.review.takePair" : "capture.review.takeBack"),
            variant: .primary,
            size: .large,
            fullWidth: true,
            action: model.takeSecondPhoto
          )
          .accessibilityIdentifier("cap-review-take-back")
        } else {
          AppButton(
            CaptureText.localized("capture.review.done"),
            variant: .primary,
            size: .large,
            fullWidth: true,
            action: model.done
          )
          .accessibilityIdentifier("cap-review-done")
        }
        AppButton(
          CaptureText.localized("capture.review.retake"),
          variant: .secondary,
          size: .large,
          fullWidth: true,
          action: model.retake
        )
        .accessibilityIdentifier("cap-review-retake")
      }
      .padding(.horizontal, AppSpacing.space20)
      .padding(.vertical, AppSpacing.space16)
    }
  }

  /// One photo from the store, whole and at its aspect ratio on a surface-2 box; a real photo never gets
  /// the AI badge. With `height` the box has that height (the review, SC19), so the photo never pushes the
  /// back question and its buttons off screen; without it the box is square (the batch summary tiles).
  struct CapturePhotoTile: View {
    let image: UIImage?
    let label: String
    var height: Double?
    var cornerRadius = AppRadius.radius16
    @Environment(\.appTheme) private var theme

    var body: some View {
      box
        .overlay {
          if let image {
            Image(uiImage: image)
              .resizable()
              .scaledToFit()
          }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .frame(maxWidth: .infinity)
        .accessibilityElement()
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isImage)
    }

    @ViewBuilder private var box: some View {
      let fill = theme.color(.surface2)
      if let height {
        fill.frame(height: height)
      } else {
        fill.aspectRatio(1, contentMode: .fit)
      }
    }
  }

  /// The system photo picker, inline, one photo (capture brief §7 Q17). The picked still is measured once
  /// (`CaptureStillAnalyzer`) and handed to the model, which shows tips or goes straight to review.
  struct CaptureImportPickerView: View {
    let model: CaptureModel
    let photos: CapturePhotoStore
    @State private var selection: PhotosPickerItem?
    @Environment(\.appTheme) private var theme

    /// Long side of the still the app keeps and measures.
    private static let maxImportPixels = 2048

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.picker.import"),
          closeID: "cap-import-close",
          onClose: model.importCancelled
        )
        PhotosPicker(selection: $selection, matching: .images, photoLibrary: .shared()) {
          EmptyView()
        }
        .photosPickerStyle(.inline)
        .photosPickerDisabledCapabilities(.selectionActions)
        .disabled(selection != nil)
      }
      .background(theme.color(.background).ignoresSafeArea())
      .task(id: selection) { await importSelection() }
    }

    /// Loads, measures and hands over the picked photo. An unreadable photo returns to where the import
    /// started, as a cancel does: nothing was kept.
    private func importSelection() async {
      guard let selection else { return }
      let data: Data?
      do {
        data = try await selection.loadTransferable(type: Data.self)
      } catch {
        data = nil
      }
      guard !Task.isCancelled else { return }
      guard let data, let image = CaptureImageReader.uprightImage(from: data, maxPixels: Self.maxImportPixels) else {
        model.importCancelled()
        return
      }
      let observation = await CaptureStillAnalyzer.observe(image)
      guard !Task.isCancelled else { return }
      model.importPicked(photos.add(UIImage(cgImage: image)), observation: observation)
    }
  }

  /// `cap-screen-import-tips`: each failing check of the still as a tip; "Keep anyway" and "Choose
  /// another". An import is never refused.
  struct CaptureImportTipsView: View {
    let model: CaptureModel
    let tips: [CaptureHint]
    @Environment(\.appTheme) private var theme

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.localized("capture.access.header"),
          closeID: "cap-import-close",
          onClose: model.close
        )
        ScrollView {
          VStack(alignment: .leading, spacing: AppSpacing.space16) {
            Text(CaptureText.localized("capture.import.title"))
              .font(theme.font(AppTypography.title3))
              .foregroundStyle(theme.color(.text))
              .accessibilityAddTraits(.isHeader)
            ForEach(tips, id: \.self) { tip in
              HStack(alignment: .firstTextBaseline, spacing: AppSpacing.space12) {
                AppIcon(CaptureHintCard.glyph(for: tip), size: .md, tint: .warningFg)
                Text(CaptureText.hint(tip, guide: CaptureGuide(family: .generic, mode: .flat, side: .front)))
                  .font(theme.font(AppTypography.callout))
                  .foregroundStyle(theme.color(.text))
                  .fixedSize(horizontal: false, vertical: true)
              }
              .accessibilityElement(children: .combine)
              .accessibilityIdentifier("cap-import-tip-\(tip.rawValue.replacingOccurrences(of: "cap-hint-", with: ""))")
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(AppSpacing.space20)
        }
        VStack(spacing: CaptureMetrics.sheetActionGap) {
          AppButton(
            CaptureText.localized("capture.import.chooseAnother"),
            variant: .primary,
            size: .large,
            fullWidth: true,
            action: model.chooseAnotherImport
          )
          .accessibilityIdentifier("cap-import-choose-another")
          AppButton(
            CaptureText.localized("capture.import.keepAnyway"),
            variant: .secondary,
            size: .large,
            fullWidth: true,
            action: model.keepImportAnyway
          )
          .accessibilityIdentifier("cap-import-keep-anyway")
        }
        .padding(.horizontal, AppSpacing.space20)
        .padding(.vertical, AppSpacing.space16)
      }
      .background(theme.color(.background).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-screen-import-tips")
    }
  }

  /// `cap-screen-batch-summary`: the batch's photos, kept on the phone until the flow closes.
  struct CaptureBatchSummaryView: View {
    let model: CaptureModel
    let photoIDs: [CapturePhotoID]
    let photos: CapturePhotoStore
    @Environment(\.appTheme) private var theme

    private let columns = Array(
      repeating: GridItem(.flexible(), spacing: CaptureMetrics.pickerColumnGap, alignment: .top),
      count: 3
    )

    var body: some View {
      VStack(spacing: 0) {
        CaptureModalHeader(
          title: CaptureText.itemCount(photoIDs.count),
          closeID: "cap-summary-close",
          onClose: model.done
        )
        ScrollView {
          VStack(alignment: .leading, spacing: AppSpacing.space16) {
            Text(CaptureText.localized("capture.summary.line"))
              .font(theme.font(AppTypography.footnote))
              .foregroundStyle(theme.color(.textSecondary))
            LazyVGrid(columns: columns, spacing: AppSpacing.space12) {
              ForEach(Array(photoIDs.enumerated()), id: \.offset) { index, id in
                let label = CaptureText.formatted("capture.summary.photo", index + 1)
                VStack(spacing: AppSpacing.space4) {
                  CapturePhotoTile(image: photos.images[id], label: label)
                  Text(label)
                    .font(theme.font(AppTypography.caption))
                    .foregroundStyle(theme.color(.text))
                    .accessibilityHidden(true)
                }
              }
            }
          }
          .padding(AppSpacing.space20)
        }
        AppButton(
          CaptureText.localized("capture.summary.done"),
          variant: .primary,
          size: .large,
          fullWidth: true,
          action: model.done
        )
        .accessibilityIdentifier("cap-summary-done")
        .padding(.horizontal, AppSpacing.space20)
        .padding(.vertical, AppSpacing.space16)
      }
      .background(theme.color(.background).ignoresSafeArea())
      .accessibilityElement(children: .contain)
      .accessibilityIdentifier("cap-screen-batch-summary")
    }
  }
#endif
