// Every string the capture flow can show or speak exists in the String Catalog: a missing key would show
// the key itself on screen. Walks the registry's hints, every family × offered mode × side, and the fixed
// copy of capture brief §6–§8.
import AIStylistKernel
import CaptureFeature
import CaptureModel
import Testing

/// The keys the screens read directly (the copy outside hints and guides).
private let fixedKeys = [
  "capture.picker.title", "capture.picker.underwear", "capture.picker.batch", "capture.picker.import",
  "capture.underwear.title", "capture.optin.title", "capture.optin.body", "capture.optin.flatOnly",
  "capture.optin.allowWorn", "capture.anyway", "capture.shutter", "capture.camera.skip", "capture.batch.next",
  "capture.batch.done", "capture.step.back", "capture.step.pair", "capture.a11y.close", "capture.a11y.help",
  "capture.a11y.torch", "capture.a11y.speech.on", "capture.a11y.speech.off", "capture.a11y.import",
  "capture.a11y.more", "capture.menu.allowWorn", "capture.menu.allowWorn.helper", "capture.menu.on",
  "capture.menu.off", "capture.mode.selected", "capture.mode.notSelected", "capture.review.title",
  "capture.review.question.back", "capture.review.question.pair", "capture.review.same",
  "capture.review.different", "capture.review.no", "capture.review.yes", "capture.review.takeBack",
  "capture.review.takePair", "capture.review.retake", "capture.review.done", "capture.review.photo.front",
  "capture.review.photo.back", "capture.review.photo.pair", "capture.import.title", "capture.import.keepAnyway",
  "capture.import.chooseAnother", "capture.summary.line", "capture.summary.done", "capture.access.header",
  "capture.access.permission.title", "capture.access.permission.body", "capture.access.permission.settings",
  "capture.access.import", "capture.access.noCamera.title", "capture.access.noCamera.body", "capture.help.title",
  "capture.help.body", "capture.help.done",
]

/// Every guide a camera screen can show: each family's offered modes (front), its back step, and the
/// shoes' pair step instead of a back step.
private var allGuides: [CaptureGuide] {
  CaptureShapeFamily.allCases.flatMap { family in
    let fronts = family.modes.map { CaptureGuide(family: family, mode: $0, side: .front) }
    let second = CaptureGuide(family: family, mode: .flat, side: family == .shoes ? .pair : .back)
    return fronts + [second]
  }
}

@Suite("Capture copy")
struct CaptureTextTests {
  @Test("every fixed string is in the catalog")
  func fixedStrings() {
    for key in fixedKeys {
      #expect(CaptureText.localized(key) != key, "missing \(key)")
    }
  }

  @Test("every hint has on-screen text, and every spoken hint a spoken line")
  func hints() {
    let guide = CaptureGuide(family: .top, mode: .flat, side: .front)
    for hint in CaptureHint.allCases where hint != .guide {
      #expect(CaptureText.hint(hint, guide: guide) != hint.rawValue, "missing \(hint.rawValue)")
    }
    for hint in CaptureHint.allCases where hint != .guide && hint != .warmingUp {
      let spoken = CaptureText.spoken(CaptureUtterance(hint: hint))
      #expect(spoken != "\(hint.rawValue).spoken", "missing spoken \(hint.rawValue)")
    }
  }

  @Test("every guide a camera screen can show has its family instruction")
  func guides() {
    for guide in allGuides {
      let key = CaptureText.instructionKey(for: guide)
      #expect(CaptureText.instruction(for: guide) != key, "missing \(key)")
    }
  }

  @Test("the guide hint reads the family instruction, on screen and spoken")
  func guideHint() {
    let guide = CaptureGuide(family: .shoes, mode: .flat, side: .pair)
    #expect(CaptureText.hint(.guide, guide: guide) == "Both shoes, side by side")
    #expect(CaptureText.spoken(CaptureUtterance(hint: .guide, guide: guide)) == "Both shoes, side by side")
  }

  @Test("tiles, sub-picks and modes have labels; subtitles only where the brief gives one")
  func pickerLabels() {
    for family in CaptureShapeFamily.allCases {
      #expect(CaptureText.familyLabel(family) != "capture.family.\(family.rawValue)")
    }
    #expect(CaptureText.familySubtitle(.top) == "T-shirts, shirts, knitwear, hoodies")
    #expect(CaptureText.familySubtitle(.shoes) == nil)
    for pick in UnderwearPick.allCases {
      #expect(CaptureText.underwearLabel(pick) != "capture.underwear.\(pick.rawValue)")
    }
    for mode in CaptureMode.allCases {
      #expect(CaptureText.modeLabel(mode) != "capture.mode.\(mode.rawValue)")
    }
  }

  @Test("formatted strings fill their argument")
  func formatted() {
    #expect(CaptureText.itemCount(1) == "1 item")
    #expect(CaptureText.itemCount(3) == "3 items")
    #expect(CaptureText.shutterLabel(lockedBecause: nil) == "Take photo")
    #expect(
      CaptureText.shutterLabel(lockedBecause: "Move closer") == "Take photo, unavailable: Move closer")
    #expect(CaptureText.anywayReason(.surfaceTip, guide: allGuides[0]).hasPrefix("No item found."))
  }
}
