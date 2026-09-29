# Optimistic auth gate and token identity guard

Objective:
Recover and verify PR #473. Done when its exact task evidence is live, every
source-listed auth and React case passes, package gates pass, and the PR body
accurately reports the final proof.

Flow mode:
one-shot execution

Goal plan:
docs/plans/473-optimistic-auth-gate.md

Template:
docs/plans/templates/task.md

Primary template:
docs/plans/templates/task.md

Applied packs:
- package-api (docs/plans/templates/packs/package-api.md)

Linked plans:
- None.

User requirements:
- Adopt the existing PR instead of closing it because its work is substantive.
- Finish the exact PR through the task contract, then return control to
  autoclosure for feedback, final checks, and merge.

Task source:
- type: GitHub pull request recovery
- id / link: https://github.com/udecode/kitcn/pull/473
- title: `feat(react): optimistic auth gate, token identity guard, optimisticUpdate passthrough, deterministic server construction`
- acceptance criteria: the five behavior groups and test cases in the PR body,
  plus exact-PR task evidence, package build and checks, a matching changeset,
  and the required task-style PR body

Timed checkpoint:
- requested duration: N/A. The user requested immediate closeout, not a timed run.
- semantics: N/A.
- initial confidence score: N/A. Completion uses binary evidence gates.
- improvement loop: Fix only defects inside the existing PR contract.
- final score / loop closure: N/A. The root autoclosure plan owns final closure.

Completion threshold:
- The live PR body contains exactly one
  `🧭 Task plan: docs/plans/473-optimistic-auth-gate.md` line. The file exists
  at that exact head and names PR #473.
- Every source-listed case has focused test or source-audit evidence on the
  committed head.
- The package build, relevant typecheck, lint, changeset audit, and repository
  check pass or the root plan records a real external blocker.
- The PR body uses the task-style contract and matches the final evidence.
- Task closure is legal only when the source-of-truth acceptance criteria are
  satisfied or explicitly narrowed, required verification evidence is recorded,
  code-review and release-artifact gates are closed when applicable, verified
  code changes are committed and PR'd unless explicitly declined or blocked,
  task-style PR body sync is complete or marked N/A with reason,
  GitHub issue/PR sync is complete or marked N/A with reason, and
  `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` passes.

Verification surface:
- Focused tests in the four changed test files under `packages/kitcn/src`.
- Source audit of the auth provider, HTTP token path, mutation options, server
  client construction, exports, static import graph, and changeset.
- `bun --cwd packages/kitcn build`, the owning typecheck, `bun lint:fix`, and
  `bun check` from the PR worktree.
- `gh pr view` read-back of the final body, head OID, checks, and merge state.

Constraints:
- Preserve existing user-facing behavior outside the task scope.
- Prefer the durable ownership boundary over caller-by-caller patches.
- When a GitHub PR is in scope, this plan owns exactly one PR. A coordinating
  batch plan must link a separate task plan for every PR an agent processes.
- Verified code changes must be committed and PR'd because the task skill
  requires that path unless the user explicitly says not to, the work has no
  local patch, or a real blocker is recorded.
- The absence of a separate "open a PR" sentence from the user is not a valid
  N/A reason for verified code-changing task work.
- A PR created by this task must use the PR #270 emoji task-style PR body
  contract below, not a generic summary/body from a git helper skill.
- A task-run PR body must include
  `🧭 Task plan: docs/plans/<plan>.md`; the plan must exist at the PR head and
  identify the exact PR before autoclosure.
- Do not add broad ceremony when the task is trivial or docs-only.

Boundaries:
- Source of truth: PR #473 body, its immutable head, and the package owners in
  `packages/kitcn`.
- Allowed edit scope: the existing changed package files and tests, its
  changeset, this plan, and the PR body. Add docs only if the public guidance
  audit proves a real gap.
- Browser surface: N/A. The PR changes library state and typed options, not a
  rendered route.
- GitHub issue sync: N/A. No linked issue is named in the PR.
- Non-goals: new auth features, compatibility shims, scaffold changes, UI
  changes, deployment, or stack/base rewrites.

Output budget strategy:
- Read exact changed files and bounded diffs. Save or count broad test and
  feedback output before inspecting only failing slices. Exclude generated
  builds, `node_modules`, coverage, and `tmp` by default.

Blocked condition:
- Stop if the contributor branch cannot be updated, a required public behavior
  cannot be verified without unavailable external state, or distinct repair
  attempts reproduce the same environment failure.

Task state:
- task_type: feature recovery and package API verification
- task_complexity: non-trivial, but not a new architecture task because the PR
  contract and implementation boundary are already concrete
- current_phase: implementation review
- current_phase_status: active after exact-PR recovery
- next_phase: verification
- goal_status: active

Current verdict:
- verdict: repair-source
- confidence: high that the PR is recoverable; merge readiness remains unproven
- next owner: task
- reason: the immutable head has a coherent, substantive delta and detailed
  acceptance cases, but it lacks the exact task-plan evidence required before
  autoclosure review

Implementation readiness:
- verdict: repair-source
- exact owner: `packages/kitcn` auth-client and React package code in PR #473
- contradiction status: no contradiction found during bounded intake; full
  source and test review begins only after the evidence repair reaches the head
- source-listed cases complete: extracted below; proof is pending

Pre-solution issue challenge:
- reporter claim: Convex orders authentication before queued queries, an SSR
  token can safely open the query gate before socket confirmation, and an
  identity-changing refresh can otherwise send queued work as another identity
- suggested diagnosis or fix: optimistic auth plus a JWT identity guard at the
  shared token-fetch boundary, guarded HTTP token access, Convex-owned
  optimistic updates, and injected server logging
- repro ladder:
  - tests / source-level repro: existing focused tests are present; review and
    execution are pending after evidence repair
  - repo-owned automated browser or integration proof: N/A unless source review
    shows the unit boundary cannot model an auth ordering claim
  - Browser plugin: N/A because there is no rendered browser contract
  - screenshot / visual proof: N/A because no visual state changes
- reproduction verdict: pending
- validity verdict: pending
- best long-term fix boundary: the shared token fetch/admission boundary and
  Convex's own local store, not individual query or mutation callers
- harsh honest feedback: pending
- hard-stop decision: continue only after exact-PR task evidence is committed,
  pushed, and read back at the live head

Completion rule:
- Do not call `update_goal(status: complete)` while any required checklist item
  remains unchecked. If an item does not apply, check it and add `N/A: <reason>`.
- Do not call `update_goal(status: complete)` until every completion threshold
  above is satisfied, final handoff evidence is recorded, and
  `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` passes.
- Do not create hook state for this goal. This file plus the active goal are the
  durable state.

Start Gates:
| Gate | Applies | Evidence |
|------|---------|----------|
| Timed checkpoint parsed | no | N/A. No duration was requested. |
| Walkthrough baseline for possible UI change | no | N/A. The PR has no rendered UI change. |
| Skill analysis before edits | yes | Loaded `autoclosure`, `task`, `autogoal`, Better Auth guidance, diagnosis, testing, TDD, changeset, poteto Babysit and Shipping, unslop, technical writing, and deslop |
| Active goal checked or created | yes | Root goal points to `docs/plans/473-autoclosure.md`; this exact task plan is linked from it |
| Source of truth read before edits | yes | PR #473 body, three commits, changed paths, checks, comments, and immutable head read first |
| Exact per-PR task ownership | yes | This plan owns only https://github.com/udecode/kitcn/pull/473 |
| GitHub comments and attachments read | yes | Two bot comments, no reviews, no inline comments, and no media attachments at intake |
| Video transcript evidence required | no | N/A. The PR has no video or screen recording. |
| Pre-solution issue challenge required | yes | Auth-ordering and identity-change claims are recorded above; validity remains a closeout proof item |
| Reproduction verdict before implementation | yes | Repository gate reproduced a deterministic cross-file test failure before its test-only fix |
| Repro escalation ladder selected | yes | Focused source tests own this non-visual package behavior. Browser and screenshot proof are N/A. |
| Suggested fix reviewed against durable boundary | yes | The shared token-fetch boundary and Convex local store are the proposed owners; full review follows evidence recovery |
| `docs/solutions` checked for non-trivial existing-code work | yes | No matching auth-identity, ConvexHttpClient, or mock-contamination solution exists |
| TDD decision before behavior change or bug fix | yes | Existing failing server-client tests formed the red signal; the contaminator-victim pair proved the fix |
| Branch decision for code-changing task | yes | Preserved PR head `424a3bec...` on local `codex/pr-473-autoclosure`; target remains `EfficiencyCorp:feat/optimistic-auth-gate` |
| Release artifact decision | yes | Reuse and audit `.changeset/optimistic-auth-gate.md` |
| Browser tool decision for browser surface | no | N/A. No rendered or native browser behavior changes. |
| Commit / PR expectation decision | yes | Commit and push to the existing PR are required after `bun check` passes or the user explicitly waives its unrelated fixture lane |
| Task-style PR body decision | yes | Replace the current prose body with the required PR #270 task format while preserving the auto-release block |
| Task-plan PR body evidence | yes | Live body has exactly one `🧭 Task plan: docs/plans/473-optimistic-auth-gate.md` line and the plan exists at the recovered head |
| GitHub issue sync expectation decision | no | N/A. No linked issue exists. |
| Output budget strategy recorded | yes | Recorded above before broad review or feedback inventory |
| Package/API pack selected | yes | `package-api` is materialized in this plan |
| Public surface or package boundary identified | yes | `ConvexAuthProvider` props, cRPC mutation options, HTTP token context, and server `ConvexQueryClient` behavior |
| Convex entry/import graph impact identified | yes | Client and server React entry graphs require an import audit after recovery |
| CLI/scaffold/generated impact identified | no | Immutable PR diff changes no CLI, scaffold, fixture, generated, or tooling owner |
| Release artifact path selected | yes | `.changeset/optimistic-auth-gate.md` |
| `changeset` skill loaded when `.changeset` is required | yes | Loaded and compared the draft with the current changelog style |
| Package build / fixture impact decision recorded | yes | Package build applies and passes. Fixture generation is N/A to the PR; the user explicitly waived only the unrelated live Expo template drift lane. |

Work Checklist:
- [ ] If a duration was requested, it is recorded as minimum active work unless
      explicitly marked hard stop; when no better metric exists, initial and
      final confidence scores are recorded.
- [ ] Objective includes outcome, completion threshold, verification surface,
      constraints, boundaries, and blocked condition.
- [ ] Task source classified with source type, id/link, title, task type,
      acceptance criteria, caveats, likely files/routes/packages, browser
      surface, and root-cause layer.
- [ ] Every GitHub PR in scope has its own task plan. This plan owns one exact
      PR, owns a not-yet-created PR slice, or records N/A because no PR is in
      scope; a batch plan is not used as a substitute.
- [ ] Required video or screen-recording evidence is cached/read as normalized
      `<video-transcripts>` XML, or marked N/A with reason.
- [ ] For public GitHub bug reports, behavior claims, technical diagnoses, or
      suggested fixes, reporter claims are challenged before implementation
      with a recorded verdict: `valid`, `not reproduced`, `invalid`,
      `wont-fix`, `partially valid`, or `platform limitation`. Feature, docs,
      support, or cleanup requests with no bug claim may mark reproduction
      `N/A` with reason.
- [ ] Repro escalation ladder followed for bug/behavior claims: focused
      test/source-level repro first when applicable; existing repo-owned
      automated browser or integration proof next when available and useful as
      executable coverage; the repo-approved Browser tool next when tests or
      automation cannot reproduce or cannot model the surface honestly;
      screenshot or explicit visual-proof waiver when visual/native state
      matters.
- [ ] Hard-stop rule followed for bug/behavior claims: no code when the issue
      is not reproduced, invalid, or won't-fix; partial validity pivots to the
      best long-term fix and records what was wrong or incomplete in the
      issue's proposed path.
- [ ] Nearby repo instructions and implementation patterns read before edits.
- [ ] Source-listed case matrix is complete and every contradiction has an
      owner, harness, and verdict before mutation.
- [ ] Readiness is classified `ready`, `repair-source`, `major`, `blocked`, or
      `invalid` with evidence.
- [ ] Implementation fixes the right ownership boundary, or the narrower choice
      is recorded with reason.
- [ ] Release artifact requirement recorded: active changeset, new changeset, or
      N/A with reason.
- [ ] Final handoff shape decided: bug/feature/testing/batch/review/GitHub
      requirements, PR body sync, and issue sync when applicable.
- [ ] Commit/PR handling recorded for code-changing work: commit and PR
      completed, no local patch, user explicitly declined, or blocker recorded.
      "User did not separately ask for a PR" is not a valid blocker.
- [ ] PR body shape recorded: PR #270 emoji task-style body used, N/A reason
      recorded, or blocker recorded.
- [ ] PR task evidence recorded: body includes `🧭 Task plan: ...`, the plan
      exists at the PR head, and it identifies the exact PR before autoclosure.
- [ ] Branch handling recorded for code-changing work: dedicated branch used,
      new branch needed, or N/A with reason.
- [ ] Local-env-rot retry policy recorded for any surprising repo-wide failure:
      reinstall/rerun evidence or N/A with reason.
- [ ] Workspace authority recorded: every proof command names the cwd/tool that
      owns the changed behavior.
- [ ] Output budget discipline recorded and followed: broad searches are
      scoped, capped, counted, or artifacted instead of streamed into goal
      context.
- [ ] High-risk note recorded for public API, runtime, package-boundary,
      browser behavior, agent-action, or command-contract changes, or marked
      N/A with reason.
- [ ] Review/autoreview target selected from actual diff state for non-trivial
      implementation work, or marked N/A with reason.
- [ ] Agent-native review decision recorded for `.agents/**`, `.claude/**`,
      `.codex/**`, skills, hooks, commands, prompts, or user-action tooling.
- [ ] Package/API pack: public API, package boundary, export, and release-artifact impact are recorded.
- [ ] Package/API pack: release artifact matrix is applied: `.changeset` or explicit no-artifact reason.
- [ ] Package/API pack: `.changeset` work loads `changeset` and follows its package/version/prose rules.
- [ ] Package/API pack: no-artifact decisions state why the diff has no published package user-visible delta from `main`.
- [ ] Package/API pack: compatibility, migration, or hard-cut decision is explicit when public shape changes.
- [ ] Package/API pack: affected Convex static import graphs stay narrow and
      plugin/per-module boundaries are used where appropriate.
- [ ] Package/API pack: CLI commands remain deterministic, `--json` capable,
      and non-interactive with explicit confirmation bypass when relevant.
- [ ] Package/API pack: docs and `packages/kitcn/skills/kitcn/**` stay
      current-state synchronized when public guidance changes.
- [ ] Package/API pack: package-owned typecheck/build/test proof is recorded or marked N/A with reason.
- [ ] Package/API pack: `packages/kitcn` build, fixture sync/check, or other owning package proof is recorded when required.

Completion Gates:
| Gate | Applies | Required action | Evidence |
|------|---------|-----------------|----------|
| Named verification threshold | pending | Run the command, proof, source audit, or artifact check named in this plan | pending |
| Exact per-PR task ownership | pending | Record the exact PR and dedicated plan, or the not-yet-created single-PR slice | pending |
| Pre-solution issue challenge verdict | pending | Record reporter claim, suggested fix, repro verdict, validity verdict, durable boundary, and hard-stop/pivot decision before implementation | pending |
| Repro escalation ladder | pending | For bug/behavior claims, record test/source-level, automated browser/integration, Browser, and screenshot/visual-proof outcomes or N/A/blocker reasons before `not reproduced` | pending |
| Bug reproduced before fix | pending | Record failing test/repro or N/A with reason | pending |
| Targeted behavior verification | pending | Run focused test/proof for changed behavior or record N/A | pending |
| TypeScript or typed config changed | pending | Run relevant typecheck | pending |
| Package exports or file layout changed | pending | Run the relevant package build before final verification and keep generated updates | pending |
| Package manifests, lockfile, or install graph changed | pending | Run `bun install` and relevant package checks | pending |
| Agent rules or skills changed | pending | Run `bun install` and verify generated skill sync | pending |
| Workspace authority proof | pending | Run verification in the owning repo/package/app/route/tool and record cwd; do not count the wrong workspace as proof | pending |
| Browser surface changed | pending | Capture Browser Use proof or record explicit waiver/blocker | pending |
| Browser final proof | pending | Attach screenshot or exact browser verification caveat when browser proof applies | pending |
| UI walkthrough | pending | If UI or rendered output changed, run `.agents/skills/walkthrough/SKILL.md` after final proof and show annotated images in the final handoff; otherwise record N/A | pending |
| Scaffold or fixture output changed | pending | Run `bun run fixtures:sync` and `bun run fixtures:check`, or record N/A | pending |
| Package behavior or public API changed | pending | Add a changeset or record why no changeset applies | pending |
| Docs and kitcn skill sync changed | pending | Keep `www/**` and `packages/kitcn/skills/kitcn/**` in sync, or record N/A | pending |
| Docs or content changed | pending | For docs-heavy work, use `--template docs`; for incidental docs, verify source-backed claims, links, examples, and rendered output or record N/A | pending |
| High-risk mini gate | pending | For public API/runtime/package-boundary/browser/agent-action/command-contract changes, record realistic failure mode, proof plan, and why the chosen boundary is right; otherwise N/A | pending |
| Agent-native review for agent/tooling changes | pending | For `.agents/**`, `.claude/**`, `.codex/**`, skills, hooks, commands, prompts, or user-action tooling, load `.agents/skills/agent-native-reviewer/SKILL.md` and close accepted/actionable findings, or record N/A | pending |
| Local install corruption suspected | pending | Run `bun install` once, rerun the exact failing command, or record N/A | pending |
| Commit created | pending | For verified code-changing work, stage the entire current checkout per repo policy and create a commit; N/A only for no local patch, explicit user decline, analytical/blocked/inconclusive work, or recorded external blocker | pending |
| PR create or update | pending | For verified code-changing work, run `check`, push, create or update the PR, and sync PR body to the task-style final handoff; N/A only for no local patch, explicit user decline, analytical/blocked/inconclusive work, or recorded external blocker | pending |
| Task-style PR body verified | pending | Verify the PR body with `gh pr view --json body`; it must preserve auto-release blocks when applicable, must not include a current-PR self-link, and must use the PR #270 emoji format: `🐛 Fixes ...`, `🟢 95-100% confidence`, `Phase / 🧪 Tests / 🌐 Browser` table, and bold emoji Outcome/Caveat/Design/Verified sections | pending |
| PR task evidence verified | pending | Verify body plan line, plan at PR head, and exact PR ownership | pending |
| PR proof image hosting | pending | If PR body needs browser proof, replace local image paths with hosted GitHub URLs or record N/A | pending |
| GitHub issue sync-back | pending | Post concise issue sync after PR exists, or record N/A/blocker | pending |
| Final handoff contract | pending | Fill the final handoff fields below with exact PR/issue/confidence/tests/browser/outcome/caveats/design/verification content or N/A reason | pending |
| Final lint | pending | Run `bun lint:fix` or scoped equivalent | pending |
| Output budget discipline | pending | Verify no unbounded high-volume command output was streamed, or record the accidental output and recovery | pending |
| Timed checkpoint | pending | If duration was requested, keep improving until elapsed, then finish the current loop cleanly; otherwise N/A | pending |
| Autoreview for non-trivial implementation changes | pending | Load `.agents/skills/autoreview/SKILL.md`; use dirty local `--mode local`, branch/PR `--mode branch --base <base>`, or committed slice `--mode commit --commit <ref>` until no accepted/actionable findings, or record N/A for docs-only/trivial/no local patch | pending |
| Goal plan complete | yes | Run `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` | pending |
| Public API / package boundary proof | pending | Source-audit public API, exports, and package boundary impact | pending |
| Convex bundle/import proof | pending | Audit affected function-entry static graphs or record N/A | pending |
| CLI/scaffold/generated proof | pending | Prove command contract and regenerate owned output or record N/A | pending |
| Release artifact classification | pending | Record whether the change is published package behavior/API/types/config/runtime or no published user-visible delta | pending |
| Published package changeset | pending | If published package users see a delta, load `changeset` and add/update one `.changeset/*.md` per package | pending |
| No release artifact | pending | If no artifact is needed, record the exact reason: internal-only, docs-only, agent-only, test-only, or no user-visible delta from `main` | pending |
| Package typecheck/build/test | pending | Run owning package checks or record N/A with reason | pending |
| Fixture/scaffold generation | pending | Run `bun run fixtures:sync` and `bun run fixtures:check` when scaffold output changed, otherwise N/A | pending |
| Docs/package skill sync | pending | Synchronize current-state public guidance or record N/A | pending |

Phase / pass table:
| Phase | Status | Evidence | Next |
|-------|--------|----------|------|
| Intake and source read | complete | source, exact PR, and recovery boundaries recorded | implementation |
| Implementation | in_progress | recovery fix is live; source review remains | verification |
| Verification | pending | | closeout |
| Commit / PR / GitHub sync | pending | | final response |
| Closeout | pending | | final response |

Findings:
- `auth-start/index.retry.test.ts` used process-global `mock.module` calls. Its
  `convex/browser` replacement removed `consistentQuery` from the class later
  imported by `react/client.test.ts`.
- Expo fixture checks run `create-expo-app@latest` with
  `default@sdk-55`. That moving upstream template changed generated guidance
  without any PR #473 scaffold or fixture edit.

Decisions and tradeoffs:
- None yet.

Implementation notes:
- None yet.

Review fixes:
- Close the Convex client before invoking `onTokenIdentityChange`, so a
  throwing consumer callback cannot leave queued work alive after the guard
  trips. A focused red test observed zero `close()` calls before the reorder.
- Replace the new source-level `any` constraint with Convex `Value` and add
  compile-time coverage for public `optimisticUpdate` and provider props.
- Document the public auth and optimistic-mutation options in `www` and the
  compressed published kitcn skill mirrors.

Error attempts:
| Error / failed attempt | Count | Next different move | Resolution |
|------------------------|-------|---------------------|------------|
| Fresh-worktree `bun check` cannot resolve built `kitcn/auth/*` exports from `convex` | 1 | Build `packages/kitcn`, then rerun the exact repository gate | Resolved. Build passed and package consumers typechecked. |
| `auth-start/index.retry.test.ts` poisons `convex/browser` for later tests | 1 | Replace process-global `mock.module` calls with file-scoped spies and rerun the minimal order | Resolved. Two failures became 15 passes and the full Bun suite passed. |
| `fixtures:check` detects upstream Expo guidance drift outside the PR diff | 1 | Keep unrelated fixture churn out of PR #473 and request either a waiver or a separately scoped repair | Resolved for this PR by the user's `go` at 2026-09-30T00:58:19+02:00. The waiver applies only to this unrelated fixture lane. |

Verification evidence:
- Red proof: `bun test packages/kitcn/src/auth-start/index.retry.test.ts packages/kitcn/src/react/client.test.ts` failed two server-mode tests because `consistentQuery` was absent after a process-global `convex/browser` mock.
- Green proof: the same command passes 15 tests after file-scoped spies replace the global mocks.
- `bun --cwd packages/kitcn typecheck` passes.
- `bun --cwd packages/kitcn build` passes and emits the React, auth-client, server, and other package artifacts.
- The full Bun test lane inside `bun check` passes 1,473 tests. The final fixture lane fails only on upstream Expo SDK 55 guidance drift outside the PR diff.

Source-listed case matrix:
| Case | Source claim | Harness | Before | Expected after | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| optimistic auth | A held, unexpired JWT opens the optional or required query gate before Convex confirmation; expiry, refusal, and default-off states stay safe | `convex-auth-provider.test.tsx` focused cases | implemented at intake; independent review pending | every named state passes | pending after evidence recovery | pending |
| token identity guard | SSR, first-token, refresh, remount, getter, admitted callback, and tripped states never hand a mismatched identity to Convex or HTTP | `convex-auth-provider.test.tsx` focused cases plus source audit | implemented at intake; independent review pending | every named identity transition passes | pending after evidence recovery | pending |
| guarded HTTP token | HTTP headers use the same guarded fetcher and omit a refused token | `context.test.tsx` focused cases | implemented at intake; independent review pending | guarded token or no header | pending after evidence recovery | pending |
| optimistic mutation | `optimisticUpdate` reaches Convex `withOptimisticUpdate` and not TanStack options | `use-query-options.test.tsx` focused cases and typecheck | implemented at intake; independent review pending | Convex owns update and rollback | pending after evidence recovery | pending |
| deterministic server client | Construction and querying avoid `Math.random`; interleaved requests preserve auth and snapshots | `client.test.ts` server-mode cases | full suite failed because another test replaced `convex/browser` process-wide | focused and full-suite cases pass | 15-test pair and 1,473-test Bun suite pass | green |
| test isolation | Auth-start retry test cannot alter the Convex client class seen by later files | contaminator-victim two-file order | two failures with missing `consistentQuery` | 15 passes with real class plus file-scoped spies | exact red and green commands recorded above | green |

Final handoff contract:
- Commit line: pending
- PR line: pending
- Issue line: pending
- Confidence line: pending
- Flow table:
  - Reproduced: tests pending, browser pending
  - Verified: tests pending, browser pending
- Browser check: pending
- Outcome: pending
- Caveat: pending
- Design:
  - Chosen boundary: pending
  - Why not quick patch: pending
  - Why not broader change: pending
- Verified: pending
- PR body verified: pending

Task-style PR body contract:
- Preserve any existing `<!-- auto-release:start -->` block. If a changeset is
  part of the diff and repo policy expects auto release, include that block.
- Use the accepted PR #270 visual format. The body starts with an emoji
  issue/fix line, for example `🐛 Fixes #123` or `🐛 Fixes ➖ N/A`, then
  `🧭 Task plan: docs/plans/<plan>.md`, then an emoji confidence line like
  `🟢 95-100% confidence`.
- Use this exact table header: `| Phase | 🧪 Tests | 🌐 Browser |`.
- Use `Reproduced` and `Verified` rows. Mark passing proof with `🟢`, repro or
  failing proof with `🔴`, and non-applicable cells with `➖ N/A`.
- Use bold emoji section headings: `**✅ Outcome**`, `**⚠️ Caveat**`,
  `**🏗️ Design**`, and `**🧪 Verified**`.
- Never include a line that links to the current PR itself. The current PR URL
  belongs in the final response, not in its own description.
- Do not replace this with a generic `Summary` / `Verification` PR body, an
  adaptive prose body from a git helper skill, plain `## Outcome` sections, or
  an unrelated generated badge footer unless the caller or repo template
  explicitly asks for it.
- Proof is `gh pr view --json body` output or a concise source-backed summary
  of that output.

Final handoff / sync:
- Commit: pending
- PR: pending
- Issue: pending
- Browser proof: pending
- Caveats: pending

Timeline:
- 2026-09-29T22:35:42.653Z Task goal plan created.
- 2026-09-30T00:39:00+02:00 First `bun check` reached workspace typecheck and
  failed only where `convex` imports package export artifacts that do not exist
  in a fresh worktree. The package build is the next different move.
- 2026-09-30T00:45:45+02:00 The branch-owned contamination fix passes its
  deterministic two-file repro, package typecheck, package build, lint, and the
  full 1,473-test Bun lane. The repository gate stops on unrelated Expo fixture
  drift before task evidence can be pushed.
- 2026-09-30T00:49:29+02:00 Revalidated live PR head
  `424a3bec59d8c9b1accf592ad534ef73ad90e7dc`, local recovery commit
  `c09c6d1b2603441eb3c68db19a6eb1903702a683`, and the fixture generator's
  moving Expo inputs. A deterministic fixture-owner repair needs its own task.
- 2026-09-30T00:50:11+02:00 The active `main` ruleset requires `CI`, one
  code-owner approval, last-push approval, and extra approval for unattributed
  changes. The available admin bypass is deliberately out of bounds.
- 2026-09-30T00:50:53+02:00 The same fixture-gate blocker remained authoritative
  for a third consecutive goal turn. No user waiver or external state change
  arrived, so the task recovery is blocked without pushing partial evidence.
- 2026-09-30T00:58:19+02:00 The user said `go`, explicitly waiving only the
  unrelated Expo fixture lane. Exact-PR recovery resumed without authorizing
  fixture changes or an admin merge bypass.
- 2026-09-30T01:00:00+02:00 Recovery commit
  `29f558fbfd5ff37222d30d006a9fbee24744e9a1` reached the contributor branch.
  GitHub head, fetched `refs/pr/473`, and local `HEAD` matched; the live body
  contained exactly one task-plan line and this plan existed at that head.

Reboot status:
| Question | Answer |
|----------|--------|
| Where am I? | Exact-PR recovery is complete; implementation review is active. |
| Where am I going? | Push the plan and test-isolation fix, update the PR body, then return to autoclosure review. |
| What is the goal? | Recover and verify PR #473 without changing its product contract. |
| What have I learned? | The implementation is substantive. One unrelated process-global test mock broke the branch's server-client tests. Expo fixture drift remains outside the PR diff. |
| What have I done? | Created the dedicated task plan, fixed the test leak, and passed the focused tests, package typecheck, package build, lint, and full Bun suite. |

Open risks:
- `bun check` is red only because the current external Expo template differs
  from committed fixture guidance. The user explicitly waived only that
  unrelated lane for PR #473; every other proof and GitHub gate remains active.
- The public auth and React API diff still needs independent source review,
  full live feedback triage, and final exact-head proof after recovery.
- GitHub approval is an external post-push wait. The merge must not use the
  current account's ruleset bypass.

Hard closeout guard:
- A local-only final response for verified code-changing work is invalid unless
  this plan records an explicit user decline, no local patch, analytical/
  blocked/inconclusive outcome, or a real commit/PR blocker.
