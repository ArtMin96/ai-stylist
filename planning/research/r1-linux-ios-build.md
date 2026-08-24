# Research: Building, Signing, and Shipping iOS Apps from Linux (2025–2026)

**Date:** August 24, 2026  
**Scope:** Production iOS app with camera + 3D requirements  
**Question:** What does xtool enable, and what still requires macOS/Xcode?

---

## 1. xtool: What It Actually Does

### Core Capabilities

**xtool** (github.com/xtool-org/xtool) is a cross-platform buildchain that compiles SwiftPM packages into iOS apps, signs them, and deploys to physical devices on Linux, Windows (WSL), and macOS.[1][3]

**Confirmed capabilities:**
- Build SwiftPM packages into `.app` and `.ipa` bundles
- Code signing for ad hoc and development provisioning profiles (free developer account eligible)[1]
- Device management: list, install, uninstall, launch apps on physical iOS devices
- Programmatic interaction with Apple Developer Services
- Direct command-line + Swift library (XKit) integration

**Current version & maturity (as of August 2026):**
xtool requires Swift 6.1+ and ships recent releases built with Swift 6.2. The project shows **active development into 2025–2026** with ongoing work on build improvements and dependency management.[1][2] GitHub activity is consistent; not abandoned.

### Supported Frameworks & UI

**What works:**
- SwiftUI (primary focus; the tool assumes declarative UI)[3]
- Pure Swift code and most standard library APIs
- Asset files (with limitations; see below)

**What does NOT work:**
- **iOS Extensions** (app clips, widget extensions, watch companions): explicitly unsupported[3]
- **App Entitlements** beyond basic code signing: most entitlements require Xcode's provisioning capability[3]
- **Interface Builder / Storyboards / XIB files**: not implemented; xtool expects SwiftUI or programmatic UI[3]
- **UIKit with Interface Builder**: not supported; programmatic UIKit *may* work but isn't documented
- **Asset Catalogs (.xcassets)**: require reverse-engineering; raw image files are the workaround[3]
- **Metal Shader Compilation**: xtool does not include Metal toolchain; shaders must be pre-compiled or handled separately[4]
- **LLDB Debugging**: not integrated; debugging requires third-party workarounds[3]
- **App Store distribution**: build signing works, but App Store upload is **not yet implemented**[3]

### React Native & Flutter Support

**Direct answer: xtool does not support React Native or Flutter projects.** xtool is Swift-only and SwiftPM-based. It cannot build compiled products for non-Swift frameworks.[5]

**Implication:** If you choose React Native or Flutter for cross-platform code sharing, xtool is irrelevant; you must use cloud CI (Codemagic, Bitrise, etc.) for iOS builds.

---

## 2. What Still Requires macOS and Xcode

Apple's toolchain has hardwired dependencies on macOS that **no third-party tool can replace** — whether you use xtool, CI/CD, or Xcode directly.

### iOS Simulator
- **Xcode requirement:** Exclusive to macOS; no Linux equivalent[6]
- **Metal API:** iOS Simulator does not support Metal; Metal code requires device testing or shader fallbacks[4]
- **Impact:** Real-device testing is mandatory for camera + 3D functionality; simulator-only development is impossible from Linux

**Mitigation:** Use physical test devices or cloud device farms (AWS Device Farm, Sauce Labs) for remote testing.

### Metal Shader Compilation
- Metal shaders **must be compiled on macOS using Xcode's `metal` toolchain** or via `xcrun -sdk iphoneos metal -ffast-math`[4]
- **Cannot be done on Linux** — no cross-compiler available; no open-source replacement
- Impact: Any 3D rendering requiring Metal requires macOS build infrastructure

**Mitigation:** Pre-compile shaders on macOS and embed `.metallib` files, or use OpenGL ES (legacy, lower performance) or ANGLE (WebGL fallback).

### Code Signing & Provisioning
- Code signing uses Apple's **proprietary signing chain** and depends on Keychain/certificates managed only on macOS[6]
- App-specific entitlements (push notifications, HealthKit, ARKit, etc.) are provisioned via Apple Developer Portal and Xcode workflows
- **Workaround available:** Free developer accounts can use ad hoc signing (works on 1–100 test devices); paid ($99/yr) accounts support TestFlight

**Practical:** xtool's signing works for ad hoc/dev profiles; you still need a Mac to **manage** certificates initially or use CI/CD tools that handle it server-side.

### Notarization & App Store Distribution
- **macOS & Xcode only:** As of April 28, 2026, all App Store submissions must use Xcode 26+[7]
- **Notarization for alternative distribution** (EU sideload): also macOS-only workflows via App Store Connect[7]
- **TestFlight upload:** Can use App Store Connect API from Linux (see below), but submission to App Store cannot

### Transporter & App Store Connect API (August 2026)
- **App Store Connect API:** Supports IPA uploads for TestFlight, working on Linux via CI/CD (Codemagic, GitHub Actions)[8][9]
- **Transporter (iTMSTransporter):** Can be installed on Linux, but starting 2026 requires `-assetFile` instead of `-f` parameter[8]
- **Impact:** TestFlight distribution is possible from Linux; final App Store submission is not

---

## 3. Distribution Paths: TestFlight & App Store from Linux

### TestFlight Distribution (Working from Linux)

**Path:** Linux build → IPA upload via App Store Connect API → TestFlight tester distribution

**Tools available:**
- **fastlane** (`upload_to_testflight` action): Works on Linux; calls App Store Connect API[8]
- **GitHub Actions** (`Apple-Actions/upload-testflight-build`): Linux runners can upload IPA via API[8]
- **Codemagic, Bitrise:** Built-in TestFlight integration; no Mac required for upload

**Limitation:** IPA **must** be pre-signed (code signing must happen on macOS or via xtool/CI tool that supports it).

### App Store Submission (macOS Required)

As of **April 28, 2026**, Xcode 26 is mandatory for App Store uploads.[7] No API bypass or third-party tool supports direct IPA → App Store submission from Linux. You must:

1. Build IPA on macOS (or CI/CD Mac instance)
2. Submit via Transporter/Xcode (requires macOS + Xcode 26+)
3. Or use CI service (Xcode Cloud, Codemagic) that runs Transporter server-side

---

## 4. Alternatives Landscape & 2026 Pricing

For a 2–3 person team doing daily iOS builds + weekly TestFlight releases:

### Option A: Hosted macOS CI (Recommended for most teams)

| Service | Free Tier | Paid Tier | M-Series Availability | Notes |
|---------|-----------|-----------|----------------------|-------|
| **Expo EAS Build** | 15 iOS + 15 Android builds/mo | $199/mo → $225 build credits | No; Cloud-only | React Native/Expo only |
| **Codemagic** | 500 M2 minutes/mo (~4–5 builds) | $333/mo fixed (unlimited) | M2/M4 available | Best for small teams; most affordable paid |
| **Bitrise** | 300 credits/mo (~1–2 builds) | $99–218/mo | M1/M4 via third-party | Good free tier; credit system unclear |
| **GitHub Actions macOS** | 2,000 mins/mo → 10,000 minutes/mo ($0/mo) | $0.062/min (standard), $0.12/min (M-series large), $0.16/min (M-series XL) | M-series available August 2026 | Cheapest at scale; pay-per-minute |
| **Xcode Cloud** | 25 compute hours/mo (free) | Tiered; paid subscriptions available | Apple silicon native | Apple-integrated; limited feature parity vs. third-party |

**Monthly cost for daily builds + weekly TestFlight (estimate):**
- 20 builds/month × 12 min avg = 240 min/month
- GitHub Actions M-series large: 240 × $0.12 = **~$29/month**
- Codemagic free tier: **$0/month** (if under 500 mins)
- Bitrise Starter: **$99/month** (includes unlimited builds but credits unclear)
- Expo EAS: **$199/month** minimum (for non-Expo projects, essentially unusable)

### Option B: Rent a Dedicated Mac (~$85–120/month)

| Provider | Hardware | Monthly Cost | Notes |
|----------|----------|--------------|-------|
| **Mac mini M4 (dedicated)** | MyRemoteMac / ZecCloud | $85–$100 | Cheapest; must manage CI yourself |
| **MacStadium** | Mac mini M4 | $119 | Established; good uptime |
| **AWS EC2 mac2.metal** | Older M1 | ~$650 (24-hr min) | Expensive; not practical for dev teams |

**DIY path cost:** Rent Mac ($90) + GitHub Actions free tier for CI orchestration = ~**$90/month** (assuming you configure GitHub Actions to SSH into the rental Mac for builds).

### Option C: Buy a Used Mac mini M4 (~$500–700 one-time, then electricity)

Purchase a used M4 Mac mini (estimated market: $500–700 in 2026), keep it running at home or colocate it.

**Cost:** One-time $600 + electricity (~$10/month) = **effective ~$40/month amortized over 18 months**

**Trade-off:** Capital upfront, but lowest ongoing cost if the team sticks with this project for 2+ years. Not viable for short-lived projects.

---

## 5. Deep Dive: Toolchain Requirements for Camera + 3D

### Camera (iOS Camera Framework)

- **xtool support:** Yes, if using pure Swift camera API
- **Requirements:** Physical device (Simulator doesn't support camera); SwiftUI + AVFoundation compatible
- **From Linux:** Build code on Linux with xtool, test on physical device with xtool sideload

### 3D Rendering (Metal, ARKit)

**Metal:**
- **xtool:** Cannot compile Metal shaders on Linux
- **Workaround:** Pre-compile shaders on macOS, embed `.metallib` files
- **CI requirement:** At least one macOS machine to pre-process shaders before Linux builds

**ARKit:**
- **xtool:** Likely works if ARKit is SwiftUI-compatible (ARView in RealityKit)
- **Testing:** Requires physical iOS device with AR capability
- **Entitlements:** May require paid developer account for certain AR features

**Implication:** A "camera + 3D" app requires:
1. **Linux for development** (Swift code, SwiftUI UI)
2. **One-time macOS setup** (compile Metal shaders, test AR on device)
3. **macOS CI** (rebuild Metal when shaders change, final App Store submission)

---

## 6. Recommended Path for Production iOS App (Camera + 3D)

### Verdict

**xtool is useful for rapid prototyping and device testing, but cannot replace macOS in the CI/CD pipeline for a production app with 3D requirements.**

### Recommended Architecture

```
Developer Machines (Linux/Windows)
↓
Push to GitHub
↓
GitHub Actions (Linux runner) — runs unit tests, linting
↓
GitHub Actions (macOS M-series runner) — builds IPA, compiles Metal shaders, codesigns
↓
TestFlight upload via App Store Connect API (Linux runner)
↓
App Store submission via Xcode Cloud or macOS CI step
```

### Practical Workflow

1. **Local development:** Use xtool on Linux for fast iteration; push code to GitHub
2. **CI/CD:** GitHub Actions orchestrates:
   - Linux runner: Run Swift tests, lint
   - macOS runner: Build IPA, compile/embed Metal shaders, sign
   - Linux runner: Upload IPA to TestFlight via API
3. **App Store:** Use Xcode Cloud (25 hrs free/month) or a final macOS CI step for submission
4. **Device testing:** Developers sideload test builds onto physical devices using xtool + USB

### Estimated Monthly Cost (Team of 3)

- GitHub Actions (macOS M-series): **~$29/month** (240 build minutes × $0.12/min)
- Xcode Cloud (free tier): **$0** (25 hrs/month covers testing + submission)
- **Total: ~$30/month** (or $0 if fits within Xcode Cloud free tier)

### Where xtool Fits

- **Quick sideload testing** to device during development
- **Not suitable for:** CI/CD critical path (Metal, final signing, App Store submission)

### Where xtool Cannot Replace macOS

| Task | xtool? | Alternative | Must-Have |
|------|--------|-------------|-----------|
| Metal shader compilation | ❌ | Pre-compile on macOS | Yes |
| iOS Simulator testing | ❌ | Physical device + cloud device farm | No (if device-testing strategy clear) |
| App Store submission | ❌ | Xcode Cloud / CI macOS runner | Yes |
| TestFlight upload | ✅ | xtool can sign; API upload from Linux | No (but nice-to-have) |
| SwiftUI development | ✅ | xtool builds, test on device | Yes |
| UIKit / Interface Builder | ❌ | Not supported; rewrite to SwiftUI | Only if UIKit required |
| Extensions (widgets, clips) | ❌ | Xcode required | No (if not in scope) |

---

## 7. Sources & Dates

### Primary (Official Docs & Specs)

1. **xtool GitHub Repository** (github.com/xtool-org/xtool) — Swift Forum announcement, active development 2025–2026, Swift 6.2
   - Status: Actively maintained
   - Quote: "Build SwiftPM package into iOS app, Sign and install iOS apps, Interact with Apple Developer Services programmatically"

2. **Swift Forums** (forums.swift.org/t/xtool-cross-platform-xcode-replacement) — Official xtool limitations documentation
   - Date: 2025
   - Limitations: No Interface Builder, no Asset Catalogs (reverse-eng required), no extensions, no LLDB, no App Store deployment

3. **Apple Developer Documentation** (developer.apple.com) — Xcode 26 requirement, SDK mandates, Notarization
   - Date: Effective April 28, 2026 (Xcode 26 mandatory)
   - Date: March 17, 2026 (EULA update due)

4. **Apple Developer News** (developer.apple.com/news/upcoming-requirements) — 2026 SDK & Xcode requirements
   - Date: Effective April 28, 2026

### Secondary (Authoritative Blogs & Guides)

5. **Codemagic Blog** (blog.codemagic.io) — CI/CD pricing comparison 2026
   - Date: 2026
   - Free tier: 500 M2 build minutes/month
   - Paid: ~$333/month fixed

6. **Code2Native Blog** (code2native.com/blog/build-ios-app-without-mac-2026) — iOS build alternatives
   - Date: 2026
   - Summary: Cloud CI (Codemagic, Bitrise, Expo EAS) for cross-platform dev

7. **GitHub Blog** (github.blog) — M-series availability announcement
   - Date: 2025–2026 (M-series runners available; pricing $0.12–0.16/min)

8. **Bitrise Pricing** (bitrise.io) — 2026 CI/CD rates
   - Date: 2026
   - Hobby free: 300 credits/month; Starter: $99/month

9. **fastlane Docs** (docs.fastlane.tools/actions/upload_to_testflight) — TestFlight upload from Linux
   - Status: Supports App Store Connect API; works on Linux

10. **MyRemoteMac Pricing** (myremotemac.com/pricing) — Mac rental rates 2026
    - Date: 2026
    - Mac mini M4: $85/month

### Community & Analysis

11. **Medium** (dimillian.medium.com) — "Build an iOS app faster than ever with xtool" (May 2025)
    - Author: Thomas Ricouard (Dimillian)
    - Status: Hands-on demo of xtool workflow

12. **CICDCalculator.com** — iOS CI/CD cost breakdown 2026
    - Detailed pricing for Codemagic, Bitrise, GitHub Actions

---

## Appendix: Disconfirming Notes

### What We Could NOT Find Definitive Answers For

1. **xtool's exact Metal shader support**: Documentation silent; assumed "none for compilation" based on Xcode-only toolchain. Possible workaround (pre-compiled shaders) inferred but not explicitly confirmed.

2. **xtool's ARKit support**: Not mentioned in official docs. Likely works via RealityKit, but not documented.

3. **Exact credit-to-build conversion for Bitrise**: Pricing in "credits" but per-minute rates not published; makes cost estimation difficult.

4. **GitHub Actions M-series runner availability outside US**: Assumed available 2026; not explicitly confirmed for all regions.

### What Contradicts Initial Assumptions

- **xtool is NOT a drop-in Xcode replacement**: Despite marketing language, it cannot replace Xcode for projects requiring extensions, Metal, Interface Builder, or App Store submission.
- **iOS Simulator has NO Linux equivalent**: Not a xtool limitation; it's an Apple hardware constraint.
- **App Store Connect API works from Linux**: Contrary to "Xcode is required," the API exists and is usable from CI/CD on any OS.

---

## Summary & Recommendation

**For a production iOS app with camera + 3D requirements from a small Linux-based team:**

1. **Use GitHub Actions macOS runners** ($30/month) as primary CI/CD
2. **Use xtool locally** for rapid device sideloading during development (optional but valuable)
3. **Pre-compile Metal shaders on macOS** (one-time or via CI) and embed `.metallib` files
4. **Xcode Cloud free tier** (25 hrs/month) covers testing + final App Store submission
5. **Accept that some tasks require macOS** — Metal, Simulator, final submission — but automate them into CI/CD
6. **Do not expect xtool to fully replace Xcode** — it's a build accelerator and device tester, not an Xcode replacement

**Expected monthly cost: ~$30–50** (GitHub Actions + Xcode Cloud free tier covers everything).

