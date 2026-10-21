import Foundation

// Guided capture camera test-frame generator (brief .claude/plans/2026-10-22-capture-camera-brief.md
// §11). Run through `just capture-frames` (tools/capture-frames/capture-frames.sh), which builds this
// with the pinned Xcode and passes the three paths.
let arguments = CommandLine.arguments
guard arguments.count == 4 else {
    progress("usage: capture-frames <repo-root> <artifacts-dir> <frames-dir>")
    exit(2)
}
do {
    let generator = Generator(
        repoRoot: URL(fileURLWithPath: arguments[1]), artifacts: URL(fileURLWithPath: arguments[2]),
        output: URL(fileURLWithPath: arguments[3]))
    print(try generator.run(), terminator: "")
} catch {
    progress("error: \(error)")
    exit(1)
}
