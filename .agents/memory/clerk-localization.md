---
name: Clerk Arabic localization
description: Clerk's bundled Arabic resource can leave auth placeholders and the development badge in English.
---

Use Clerk's official Arabic localization as the base, then provide explicit Arabic overrides for any auth strings the installed SDK leaves undefined. The development badge may not honor the localization resource, so keep a narrowly scoped language-aware label bridge for that exact text.

**Why:** The bundled `arSA` resource is intentionally partial and the development-only badge is outside the normal localization path; relying on it alone leaves visible English in the Arabic auth experience.

**How to apply:** Preserve the app's language state and document `lang`/`dir` effect while layering these overrides; do not change authentication routing or app data to solve a UI localization gap.