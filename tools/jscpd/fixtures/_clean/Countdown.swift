// Clone-check fixture (tools/jscpd/README.md): unrelated to every other `_clean` file.
import Foundation

struct Countdown {
  let deadline: Date

  func remaining(from now: Date) -> String {
    let seconds = Int(deadline.timeIntervalSince(now))
    guard seconds > 0 else {
      return "due"
    }
    let hours = seconds / 3600
    let minutes = (seconds % 3600) / 60
    return hours > 0 ? "\(hours) h \(minutes) min" : "\(minutes) min"
  }
}
