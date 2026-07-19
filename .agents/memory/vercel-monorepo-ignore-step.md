---
name: Vercel monorepo Ignored Build Step
description: Why git-diff-based ignoreCommand kept canceling deploys and what to do instead
---
Rule: for this repo's Vercel project (Root Directory = artifacts/api-server), do NOT use git-diff-based ignoreCommand skip logic — use "exit 0" (always build).

**Why:** Three variants (plain pathspecs, cd/git -C to repo toplevel, ":(top)" pathspec magic, with ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}) all behaved correctly in local testing (exit 0 → proceed) yet Vercel canceled every deployment anyway. The Vercel-side clone/env behavior could not be reproduced; hours were lost iterating blind.

**How to apply:** Keep ignoreCommand as "exit 0" in artifacts/api-server/vercel.json. If deploys still get canceled, the override lives in Vercel dashboard → Project Settings → Git → Ignored Build Step (must be "Automatic"). Vercel build cache keeps always-building cheap.
