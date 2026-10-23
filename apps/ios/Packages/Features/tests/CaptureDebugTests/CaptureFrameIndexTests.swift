// The frame index's jitter offsets (tools/capture-frames/README.md "Jitter"): the generator writes them, so
// both apps play the same shaky path. iOS only, like the frame source.
#if os(iOS)
  import CaptureDebug
  import Foundation
  import Testing

  @Suite("Capture frame index jitter offsets")
  struct CaptureFrameIndexTests {
    private func segment(_ json: String) throws -> CaptureFrameIndex.Segment {
      try JSONDecoder().decode(CaptureFrameIndex.Segment.self, from: Data(json.utf8))
    }

    @Test("a jittered segment plays its offsets in order and loops them")
    func offsetsLoop() throws {
      let segment = try segment(
        #"{"frame":"f.png","frames":3,"jitter":0.06,"jitterSeed":7,"offsets":[[0.01,-0.02],[0.05,0.03],[-0.04,0]]}"#
      )
      #expect(segment.offset(atFrame: 1) == (0.05, 0.03))
      #expect(segment.offset(atFrame: 5) == (-0.04, 0))
      #expect(segment.offset(atFrame: 6) == (0.01, -0.02))
    }

    @Test("a segment without offsets does not move")
    func noOffsets() throws {
      let segment = try segment(#"{"frame":"f.png","frames":30,"jitter":0,"jitterSeed":7}"#)
      #expect(segment.offset(atFrame: 12) == (0, 0))
    }
  }
#endif
