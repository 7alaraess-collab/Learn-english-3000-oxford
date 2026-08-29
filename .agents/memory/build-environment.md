---
name: Artifact build environment
description: Environment requirements for manually validating path-routed web artifacts.
---

Manual Vite builds for path-routed artifacts need both `PORT` and `BASE_PATH` set to the values declared in the artifact configuration.

**Why:** The development workflow injects these values automatically, while a direct package build does not; omitting either causes config loading to fail before compilation.

**How to apply:** When validating an artifact outside its managed workflow, use the configured local port and base path for the build command.