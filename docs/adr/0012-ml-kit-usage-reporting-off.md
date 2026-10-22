# ADR-0012 — Switch off ML Kit's usage-reporting channel on Android

> File name: `docs/adr/0012-ml-kit-usage-reporting-off.md`. Index: `docs/adr/README.md`.

- **Status:** Proposed (owner-approved 2026-10-22)
- **Date:** 2026-10-22
- **Deciders:** product owner; capture camera lead
- **Decision-log entry:** DEC-NN draft in `.claude/plans/2026-10-22-capture-camera-plan-changes-proposal.md` §7a _(create in doc 16 when accepted)_
- **Related:** capture brief `.claude/plans/2026-10-22-capture-camera-brief.md` (C22, C31) · doc 10 §2 row 11 · security review finding B1 (2026-10-22) · phase P06

## Context

The Android capture camera finds the item and the body parts with ML Kit Object Detection 17.0.2 and
ML Kit Pose Detection 18.0.0-beta5. Both run on the phone with bundled models. The capture camera uses
no AI provider, and photos and check results stay on the phone (doc 10 §2 row 11). ML Kit also links
Google's `datatransport` runtime. Its CCT backend sends usage reports (API calls, latency, model and
device facts) to `firebaselogging.googleapis.com`. With that channel on, Google would be a processor
of usage data the privacy docs do not name. The security review of the camera branch flagged it as B1.

## Options considered

| Option                                                                          | Pros                                                                                                                     | Cons                                                                                                                              | Evidence (primary source + as-of date)                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (chosen): remove only the CCT backend's registration from the merged manifest | ML Kit keeps running on device; no usage report can be sent; a one-line manifest change, checked in `just android-check` | Relies on the runtime's backend lookup; a future ML Kit could add another channel                                                 | Emulator run 2026-10-22: probe `objectDetectionRuns: true` (5 of 5 frames) and `poseDetectionRuns: true` (5 of 5 sets); logcat `W TransportRuntime: Transport backend 'cct' is not registered` and `D TransportRuntime.Uploader: Unknown backend for TransportContext(cct, …), deleting event batch for it...`; no `CctTransportBackend` line |
| B: accept Google as a processor of usage data                                   | No code change                                                                                                           | A new processor and data flow to name in docs 10 and 11 and in the store privacy forms, for data the product does not need        | —                                                                                                                                                                                                                                                                                                                                             |
| C: drop ML Kit                                                                  | No Google code in the camera                                                                                             | No on-device item and pose detection on Android: no item-found, cut-off or body-part lock, so the camera would not meet the brief | Brief §3; ML Kit is the only approved on-device detector for Android (Q-A (b), 2026-10-22)                                                                                                                                                                                                                                                    |

## Decision

The Android app removes the `backend:com.google.android.datatransport.cct.CctBackendFactory`
registration from `TransportBackendDiscovery` (`tools:node="remove"`). The override sits in the
manifest of `:feature:capture`, the module that brings ML Kit, where Android Lint can resolve the
class; the app's merged manifests (debug, preview, release) no longer hold the registration. The
`datatransport` runtime itself stays, because ML Kit depends on it. `just android-check` fails if the
release merged manifest has that registration again.

## Rationale

Option A keeps the detector the brief needs and removes the only channel that sends ML Kit usage data,
and it can be checked mechanically. The runtime still queues events, but with no backend it drops them.
It also deletes the batches earlier builds stored, as the uploader log shows.

## Consequences and revisit triggers

- Positive: the camera sends no ML Kit usage reports; doc 10 row 11 holds on Android too.
- Negative/accepted: ML Kit may still download model updates and accelerator allow-lists from Google.
  This ADR does not stop those calls. A full network capture of the app on a real phone is
  device-only and not done yet. `TransportRuntime` logs a warning on each detector call.
- **Revisit when:** an ML Kit or `datatransport` update registers another backend, renames the CCT
  factory, or sends reports another way (the `android-check` grep and a logcat check on each ML Kit
  bump); a device network capture shows other traffic; or the product needs Google usage reporting.
  Reversal requires a new DEC entry.
