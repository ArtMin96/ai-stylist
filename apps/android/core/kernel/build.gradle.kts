// :core:kernel compiles the GENERATED shared-kernel registries committed at
// packages/contracts/gen/kotlin-client/kernel (reason codes, entitlement names, units and the capture
// rules; tools/codegen/gen-kernel.mjs, `just generate`; ADR-0005). It has no sources of its own, so
// lint and detekt do not run on it; compiler warnings still fail the build.
plugins {
    alias(libs.plugins.aistylist.jvm.generated)
}

kotlin {
    sourceSets.named("main") {
        kotlin.srcDir(
            rootProject.layout.projectDirectory.dir(
                "../../packages/contracts/gen/kotlin-client/kernel/src/main/kotlin",
            ),
        )
    }
}
