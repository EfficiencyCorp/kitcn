# feat(react): optimistic auth gate, token identity guard, optimisticUpdate passthrough, deterministic server construction

Objective:
Adopt PR #473 through a dedicated task run: record per-PR plan evidence for
its existing implementation (auth gate, identity guard, optimisticUpdate,
server logger) and prove it with focused tests and `bun check`.

Goal plan:
docs/plans/473-optimistic-auth-gate.md

Template:
docs/plans/templates/task.md

Primary template:
docs/plans/templates/task.md

Applied packs:
- package-api (docs/plans/templates/packs/package-api.md)
- docs (docs/plans/templates/packs/docs.md): `www/` docs are a supporting
  touched surface
- agent-native (docs/plans/templates/packs/agent-native.md): the published
  kitcn skill references and their `.agents/skills/kitcn` mirror changed

Task source:
- type: GitHub PR, single-PR feature plus one bug fix, one package
- id / link: #473 https://github.com/udecode/kitcn/pull/473
- title: feat(react): optimistic auth gate, token identity guard,
  optimisticUpdate passthrough, deterministic server construction
- branch: `feat/optimistic-auth-gate` (EfficiencyCorp fork), base `main`
  3250fb9c; PR head before this plan: 424a3bec (commits 07b5927f main change,
  8f756193 `tokenIdentityBaseline`, 424a3bec getter and
  `onTokenIdentityAdmitted`).
- acceptance criteria (PR body What 1-5 plus both Update sections):
  1. `optimisticAuth` (default `false`): the gate opens on a held, unexpired
     JWT before Convex confirms it, only until the Convex client reports its
     first auth result (confirmed or refused); after that the gate follows
     Convex's confirmed state for the client's lifetime, remounts included,
     so no refused token reopens it; expired or opaque tokens never open it.
  2. `onTokenIdentityChange`: the document keeps one identity (JWT `sub` and
     `sessionId`); a held SSR token is admitted before it is published; a
     token for another identity, or an identity-less JWT once an identity is
     established, is refused before it is cached; a refusal trips the
     document terminally in the browser (every mounted provider clears its
     token, publishes unauthenticated and hands out null; later providers
     and clients start tripped; sign-in mutations throw
     `TOKEN_IDENTITY_CHANGED`; `client.close()` called before the callback);
     same-session refreshes pass.
  3. cRPC HTTP headers take their token from the guarded fetcher in
     `FetchAccessTokenContext`; without a fetcher the cache is read as before.
  4. cRPC `mutationOptions` and `useConvexMutationOptions` accept
     `optimisticUpdate`, forwarded to Convex's `withOptimisticUpdate`, never
     to TanStack. Store edits and rollback are Convex's; the test proves the
     forwarding only.
  5. The server `ConvexQueryClient`'s `ConvexHttpClient` reuses the Convex
     client's logger: constructing and querying call no `Math.random()`, and
     per-request auth and snapshots are unchanged.
  6. Update 1: `tokenIdentityBaseline?: string | null` seeds the guard for a
     provider that remounts within one document.
  7. Update 2: `tokenIdentityBaseline` also accepts a getter read at every
     admission (cached tokens included); `onTokenIdentityAdmitted` hears
     every admitted token once, never a refused one; a fresh token is
     admitted, announced and cached in one step, so concurrent first tokens
     never publish the losing identity.
  8. Default behaviour is unchanged when no new option is set, except item
     3: cRPC HTTP headers take their token from the provider's fetcher for
     every auth provider, unconditionally (see Review fixes, round 2
     declined item).
- closure and reopen history:
  - 2026-09-29T21:54:00Z zbeyens commented the autoclosure remediation:
    "Closing because this PR has no verifiable per-PR `task` run. Every PR
    must include `🧭 Task plan: docs/plans/<plan>.md` in its body, that plan
    must exist at the PR head, and it must identify this exact PR." The PR
    was closed at 21:54:10Z, before any code review.
  - 2026-09-29T22:11:18Z zbeyens reopened the PR and at 22:11:25Z edited the
    same comment to: "Reopened. The prior closure followed the old
    all-or-nothing task-evidence gate. This PR has a substantive,
    source-backed implementation to continue from, so autoclosure should
    adopt the existing branch through a dedicated `$kitcn:task
    https://github.com/udecode/kitcn/pull/473` run, repair the per-PR plan
    evidence at the PR head, then continue normal review and proof. Closing
    is reserved for PRs with no usable task state."
  - This plan follows that note: the implementation predated the plan when
    it was adopted (01a55371, historical); review rounds 1 to 3 have since
    changed runtime code (see Implementation notes).
- caveat (historical, first pass up to 01a55371): no product behaviour
  changed then; that pass added a JSDoc placement fix, a test-isolation fix
  for a pre-existing test outside the original diff (see Findings), docs for
  the new options, and this plan.
- likely files: `auth-client/convex-auth-provider.tsx`, `react/context.tsx`,
  `react/crpc-types.ts`, `react/use-query-options.ts`, `react/client.ts` and
  their tests; `.changeset/optimistic-auth-gate.md`.
- browser surface: none rendered; provider state, token hand-out, mutation
  wiring and server construction are covered by Bun/React tests.
- root-cause layer: the provider's token fetcher and gate state; the cRPC
  mutation hook; the server `ConvexQueryClient` constructor.

Task PR:
#473 https://github.com/udecode/kitcn/pull/473

Timed checkpoint:
- requested duration: N/A; no duration requested.
- semantics: N/A.
- initial confidence score: N/A; focused tests and `bun check` are the
  threshold.
- improvement loop: N/A.
- final score / loop closure: N/A.

Completion threshold:
- Every acceptance criterion has a passing focused test or typecheck.
- Item 5 is reproduced red against the unfixed source and green with the fix.
- `bun --cwd packages/kitcn typecheck`, `bun --cwd packages/kitcn build`,
  `bun lint:fix` (source unchanged) and `bun check` run with exact results.
- The changeset follows the `changeset` skill.
- Closure is not claimed in this plan: `bun check` exits 1 on a
  pre-existing repository blocker (`fixtures:check` drift, reproduced on
  `upstream/main`), `autoreview` is blocked on a missing TruffleHog binary,
  `test:runtime` did not run locally, and push, PR body application and the
  live task-evidence read-back are reserved by the requester. Each is
  recorded as blocked or handed-off below; `check-complete.mjs` passing means
  every gate is resolved or recorded, not that closure happened.
- Task closure is legal only when the source-of-truth acceptance criteria are
  satisfied or explicitly narrowed, required verification evidence is recorded,
  code-review and release-artifact gates are closed when applicable, verified
  code changes are committed and PR'd unless explicitly declined or blocked,
  task-style PR body sync is complete or marked N/A with reason,
  GitHub issue/PR sync is complete or marked N/A with reason, and
  `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` passes.

Verification surface:
- `bun test` on `convex-auth-provider.test.tsx`, `context.test.tsx`,
  `use-query-options.test.tsx`, `client.test.ts`
- `bun test packages/kitcn/src/auth-client packages/kitcn/src/react`
- `bun test packages/kitcn/src/react/client.test.ts` against `main`'s
  `client.ts` (red) and the PR's (green)
- `bun --cwd packages/kitcn typecheck`, `bun --cwd packages/kitcn build`
- `bun lint:fix`, `bun check` (Bun 1.3.9, the repo's `packageManager` pin)
- `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md`

Constraints:
- Behaviour changes only within the PR's items and the requester's review
  rulings (rounds 1 to 4); a defect found while proving it is reported first
  and fixed on the requester's ruling, as its own commit. (Historical: the
  first pass, up to 01a55371, changed no behaviour.)
- No history rewrite: new commits land on top of 424a3bec in this order:
  JSDoc fix, test fix, docs, plan.
- Every new option is opt-in and default-off.
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

Boundaries:
- Source of truth: PR #473 body (Why, What 1-5, Tests, both Update sections)
  and the maintainer's reopen note.
- Allowed edit scope (at HEAD): this plan; the `DecorateMutation` JSDoc
  placement; `auth-start/index.retry.test.ts` isolation; runtime files the
  review rulings touch (`auth-client/convex-auth-provider.tsx`,
  `auth-client/client-settlement.ts`, `react/identity-guard-trip.ts`,
  `react/token-gate.ts`, `react/auth-mutations.ts`) and their tests; `www/`
  and `packages/kitcn/skills/kitcn/**` docs for the new options; the
  changeset (wording only; the `changeset` skill requires no structural
  change, see Decisions).
- Browser surface: none.
- GitHub issue sync: N/A; no issue backs this PR.
- Non-goals: behaviour beyond the PR's items and review rulings, splitting
  the PR, default-on auth behaviour, resyncing unrelated fixture drift,
  converting other `mock.module` calls.

Output budget strategy:
- Test, build and gate output goes to `/tmp/kitcn-473*.log`; only summary
  lines (pass/fail counts, exit codes, drifted file names) are read back.

Blocked condition:
- Stop if a focused test fails, if item 5 does not reproduce red against the
  unfixed source, or if `bun check` fails on a lane the diff can affect
  (it did once: see Findings; resumed after the requester's ruling).

Task state:
- task_type: feature with one bug fix (one package, additive, opt-in)
- task_complexity: non-trivial
- current_phase: closeout
- current_phase_status: blocked (repository gate and autoreview; see
  Completion threshold)
- next_phase: requester review of fix round 6, push, PR body application,
  live compliance read-back; maintainer review continues on the PR
- goal_status: implementation and local proof complete; closeout blocked

Current verdict:
- verdict: ready for delta review of fix round 6
- confidence: 91%
- next owner: requester (delta review, push, PR body), then maintainer review
- reason: every runtime acceptance criterion and every accepted runtime
  review finding (round 1 F1-F6, round 2 R2-R4, round 3 S1-S3, round 4 T1-T2, round 5 U1-U4, round 6 V1-V2) has a behavioural focused
  test that failed before its fix and passes after it; control tests (for
  example the baseline identity still opening the gate) pass before and
  after by design. F7's spy cleanup, F8-F11 and R6-R7 are structural or
  document audits, not behavioural tests. Every gate lane the diff can
  affect passes; the socket-ordering premise rests on the #473 probe,
  disposal of queued work is Convex's `close()` semantics (not re-proved),
  `test:runtime` could not run on this machine, and autoreview is blocked.

Implementation readiness:
- verdict: ready (implementation exists; plan adopted)
- exact owner: `ConvexAuthProviderInner` token fetcher and `AuthStateSync`;
  `createCRPCContext` HTTP headers; `useConvexMutationOptions`;
  `ConvexQueryClient` constructor
- contradiction status: none
- source-listed cases complete: yes (see case matrix)

Pre-solution issue challenge:
- reporter claim: (a) on a hard load with an SSR token, auth-bound queries
  wait one socket round trip for Convex to confirm the token; (b) a refresh
  returning another identity lets Convex resume queued writes as that
  identity; (c) cRPC mutations cannot use Convex's native optimistic
  updates; (d) server `ConvexQueryClient` construction calls `Math.random()`,
  which Next Cache Components prerendering refuses.
- suggested diagnosis or fix: the five What items of the PR body.
- repro ladder:
  - tests / source-level repro: (a) to (c) are feature requests; the tests
    show the default gate stays closed until confirmation and that the new
    options change only opted-in behaviour. (d) is a bug:
    `client.test.ts` against `main`'s `client.ts` on this branch gives 13
    pass, 1 fail ("constructing and querying call no Math.random": expected
    0 calls, received 1).
  - repo-owned automated browser or integration proof: N/A; the React and
    Bun harnesses own every state transition and call count.
  - Browser plugin: N/A; no rendered UI.
  - screenshot / visual proof: N/A; nothing visual.
- reproduction verdict: (a) to (c) N/A (feature requests); (d) reproduced.
- validity verdict: (d) valid; (a) to (c) N/A for features, premise evidence
  in Design rationale.
- best long-term fix boundary: the single token fetcher every consumer uses;
  the hook that builds the Convex mutation; the server client constructor.
- harsh honest feedback: four auth props is a wide surface for one provider;
  each answers a distinct mount shape and all default off. Item 3 changes the
  HTTP header path for every app with an auth provider (see High-risk note).
- hard-stop decision: proceed.

Completion rule:
- Do not call `update_goal(status: complete)` while any required checklist item
  remains unchecked. If an item does not apply, check it and add `N/A: <reason>`.
- Do not call `update_goal(status: complete)` until every completion threshold
  above is satisfied, final handoff evidence is recorded, and
  `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` passes.
- Codex goal tools (`create_goal`, `update_goal`) are unavailable in this run
  (Claude Code). `check-complete.mjs` is the completion proof.
- Do not create hook state for this goal. This file is the durable state.

Start Gates:
| Gate | Applies | Evidence |
|------|---------|----------|
| Timed checkpoint parsed | no | N/A: no duration requested |
| Walkthrough baseline for possible UI change | no | N/A: no UI or rendered output changes |
| Skill analysis before edits | yes | `task`, `autogoal` (task template + package-api pack), `changeset`; `major-task` not used (see Decisions) |
| Active goal checked or created | yes | This plan; Codex goal tools unavailable, noted in Completion rule |
| Source of truth read before edits | yes | `gh pr view 473` body, comments and close/reopen events read |
| Exact per-PR task ownership | yes | #473 https://github.com/udecode/kitcn/pull/473 |
| GitHub comments and attachments read | yes | Autoclosure comment (edited to the reopen note), changeset-bot and Vercel comments; no attachments |
| Video transcript evidence required | no | N/A: no video evidence |
| Pre-solution issue challenge required | yes | Recorded above; item (d) reproduced |
| Reproduction verdict before implementation | yes | (d) reproduced red; (a) to (c) N/A as features |
| Repro escalation ladder selected | yes | Focused Bun test; higher rungs N/A (server call count, provider state) |
| Suggested fix reviewed against durable boundary | yes | Each item sits at its single owner (see Implementation readiness) |
| `docs/solutions` checked for non-trivial existing-code work | yes | No `docs/solutions` entry covers these owners |
| TDD decision before behavior change or bug fix | yes | Implementation predates the plan; item (d) red/green replayed by swapping in `main`'s `client.ts`; features proven by their tests |
| Branch decision for code-changing task | yes | Existing PR branch `feat/optimistic-auth-gate`; four commits on top of 424a3bec, no rewrite of pushed history |
| Release artifact decision | yes | Existing `.changeset/optimistic-auth-gate.md` kept (see Decisions) |
| Browser tool decision for browser surface | no | N/A: no browser surface |
| Commit / PR expectation decision | yes | Plan commit local; the requester pushes it to the PR branch and updates the body |
| Task-style PR body decision | yes | Replacement body drafted in the PR #270 / #459 task style |
| Task-plan PR body evidence | yes | Draft body carries one `🧭 Task plan: docs/plans/473-optimistic-auth-gate.md` line; this plan names #473 |
| GitHub issue sync expectation decision | no | N/A: no issue backs this PR |
| Output budget strategy recorded | yes | Logs to `/tmp`, summaries only |
| Package/API pack selected | yes | New public props and options in `packages/kitcn` |
| Public surface or package boundary identified | yes | `ConvexAuthProviderProps` (4 optional props); cRPC `mutationOptions` option and `ConvexOptimisticUpdateOption` type; HTTP header token source; server `ConvexHttpClient` logger |
| Convex entry/import graph impact identified | no | N/A: client and SSR entries only; the one new import (`convex/browser` `OptimisticUpdate`) is type-only |
| CLI/scaffold/generated impact identified | no | N/A: no CLI, scaffold or generated output touched |
| Release artifact path selected | yes | `.changeset/optimistic-auth-gate.md` (patch) |
| `changeset` skill loaded when `.changeset` is required | yes | Loaded; reuse rule, bump level and sections checked |
| Package build / fixture impact decision recorded | yes | Package build run; fixtures unaffected by the diff |
| Docs pack selected | yes | `www/content/docs/auth/client.mdx` and `react/mutations.mdx` changed as a supporting surface |
| Docs guidance loaded | yes | `packages/kitcn/skills/kitcn/references/setup/doc-guidelines.md` and `.agents/AGENTS.md` Docs rules read |
| Docs lane selected | yes | Incidental reference docs for new public options (`--with docs`, not `--template docs`) |
| Target docs and nearest sibling docs read | yes | Auth client Provider Configuration and Props, mutations API Reference and Common Patterns |
| Docs style doctrine read | yes | Latest-state reference voice, no changelog language (`.agents/AGENTS.md` Docs) |
| Documented source owner identified | yes | `ConvexAuthProviderProps` JSDoc and `ConvexOptimisticUpdateOption` in source; provider and hook tests |
| Agent-native pack selected | yes | Published skill references and their mirror changed |
| Agent-facing action surface identified | yes | An agent configuring the new provider props and `optimisticUpdate` from the kitcn skill |
| Source rule versus generated mirror boundary identified | yes | Source `packages/kitcn/skills/kitcn/**`; mirror `.agents/skills/kitcn/**` via `bun tooling/sync-kitcn-skill.ts` |
| Installed-skill lock versus local-rule owner identified | yes | The kitcn skill is repo-owned (published package skill); no installed-skill lock entry changed |
| `agent-native-reviewer` loaded or waiver recorded | yes | Loaded and run (see Agent-native review) |

Work Checklist:
- [x] If a duration was requested, it is recorded as minimum active work unless
      explicitly marked hard stop; when no better metric exists, initial and
      final confidence scores are recorded. N/A: no duration requested.
- [x] Objective includes outcome, completion threshold, verification surface,
      constraints, boundaries, and blocked condition.
- [x] Task source classified with source type, id/link, title, task type,
      acceptance criteria, caveats, likely files/routes/packages, browser
      surface, and root-cause layer.
- [x] Every GitHub PR in scope has its own task plan. This plan owns one exact
      PR, owns a not-yet-created PR slice, or records N/A because no PR is in
      scope; a batch plan is not used as a substitute. Owns #473.
- [x] Required video or screen-recording evidence is cached/read as normalized
      `<video-transcripts>` XML, or marked N/A with reason. N/A: none.
- [x] For public GitHub bug reports, behavior claims, technical diagnoses, or
      suggested fixes, reporter claims are challenged before implementation
      with a recorded verdict: `valid`, `not reproduced`, `invalid`,
      `wont-fix`, `partially valid`, or `platform limitation`. Feature, docs,
      support, or cleanup requests with no bug claim may mark reproduction
      `N/A` with reason. (d) valid; (a) to (c) N/A as features.
- [x] Repro escalation ladder followed for bug/behavior claims: focused
      test/source-level repro first when applicable; existing repo-owned
      automated browser or integration proof next when available and useful as
      executable coverage; the repo-approved Browser tool next when tests or
      automation cannot reproduce or cannot model the surface honestly;
      screenshot or explicit visual-proof waiver when visual/native state
      matters. (d) reproduced at the first rung.
- [x] Hard-stop rule followed for bug/behavior claims: no code when the issue
      is not reproduced, invalid, or won't-fix; partial validity pivots to the
      best long-term fix and records what was wrong or incomplete in the
      issue's proposed path. Reproduced; no hard stop.
- [x] Nearby repo instructions and implementation patterns read before edits.
- [x] Source-listed case matrix is complete and every contradiction has an
      owner, harness, and verdict before mutation.
- [x] Readiness is classified `ready`, `repair-source`, `major`, `blocked`, or
      `invalid` with evidence.
- [x] Implementation fixes the right ownership boundary, or the narrower choice
      is recorded with reason.
- [x] Release artifact requirement recorded: active changeset, new changeset, or
      N/A with reason. Active changeset kept.
- [x] Final handoff shape decided: bug/feature/testing/batch/review/GitHub
      requirements, PR body sync, and issue sync when applicable.
- [x] Commit/PR handling recorded for code-changing work: commit and PR
      completed, no local patch, user explicitly declined, or blocker recorded.
      "User did not separately ask for a PR" is not a valid blocker. The PR
      exists; the plan commit is local and the requester pushes it.
- [x] PR body shape recorded: PR #270 emoji task-style body used, N/A reason
      recorded, or blocker recorded.
- [x] PR task evidence recorded: body includes `🧭 Task plan: ...`, the plan
      exists at the PR head, and it identifies the exact PR before autoclosure.
      This plan names #473; it is at the head once the requester pushes.
- [x] Branch handling recorded for code-changing work: dedicated branch used,
      new branch needed, or N/A with reason.
- [x] Local-env-rot retry policy recorded for any surprising repo-wide failure:
      reinstall/rerun evidence or N/A with reason. See Error attempts.
- [x] Workspace authority recorded: every proof command names the cwd/tool that
      owns the changed behavior.
- [x] Output budget discipline recorded and followed: broad searches are
      scoped, capped, counted, or artifacted instead of streamed into goal
      context.
- [x] High-risk note recorded for public API, runtime, package-boundary,
      browser behavior, agent-action, or command-contract changes, or marked
      N/A with reason.
- [x] Review/autoreview target selected from actual diff state for non-trivial
      implementation work, or marked N/A with reason. Target: PR diff against
      `main`; reviewed by the requester's independent lanes and the
      maintainer's review on the PR.
- [x] Agent-native review decision recorded for `.agents/**`, `.claude/**`,
      `.codex/**`, skills, hooks, commands, prompts, or user-action tooling.
      Applies: published skill references and their mirror changed; review
      recorded under Agent-native review.
- [x] Package/API pack: public API, package boundary, export, and release-artifact impact are recorded.
- [x] Package/API pack: release artifact matrix is applied: `.changeset` or explicit no-artifact reason.
- [x] Package/API pack: `.changeset` work loads `changeset` and follows its package/version/prose rules.
- [x] Package/API pack: no-artifact decisions state why the diff has no published package user-visible delta from `main`. N/A: a changeset exists.
- [x] Package/API pack: compatibility, migration, or hard-cut decision is explicit when public shape changes. Additive optional props and option; no migration.
- [x] Package/API pack: affected Convex static import graphs stay narrow and
      plugin/per-module boundaries are used where appropriate. N/A: client and SSR files only.
- [x] Package/API pack: CLI commands remain deterministic, `--json` capable,
      and non-interactive with explicit confirmation bypass when relevant. N/A: no CLI.
- [x] Package/API pack: docs and `packages/kitcn/skills/kitcn/**` stay
      current-state synchronized when public guidance changes. `www/` auth
      client and mutations pages plus the skill's auth and react references
      updated and synced.
- [x] Package/API pack: package-owned typecheck/build/test proof is recorded or marked N/A with reason.
- [x] Package/API pack: `packages/kitcn` build, fixture sync/check, or other owning package proof is recorded when required.
- [x] Docs pack: docs lane, target docs, nearest sibling docs, and source owner are recorded.
- [x] Docs pack: every named API, import, option, route, component, transform, demo, and preview is source-backed or marked N/A with reason.
- [x] Docs pack: docs use current-state reference voice, not changelog voice.
- [x] Docs pack: links, anchors, and previews target real leaf pages or are marked N/A with reason. `#optimistic-updates` and `#mutationoptions-1` resolve to headings on the same page.
- [x] Agent-native pack: source-of-truth rule files are edited instead of generated skill mirrors.
- [x] Agent-native pack: the changed agent action is discoverable from the skill/rule text. `SKILL.md` routes to `references/features/auth.md` and `react.md`.
- [x] Agent-native pack: generated mirrors are synced when `.agents/rules/**` changed, or N/A reason is recorded. No `.agents/rules/**` change; the skill mirror is synced by its own command.
- [x] Agent-native pack: installed skills are changed only through
      `npx skills add/update/remove`; local rules/templates/helpers stay source-owned. No installed skill changed.
- [x] Agent-native pack: routing, required receipts, placeholder failure,
      completion representability, and forbidden behavior have eval/smoke rows. N/A: reference prose for a library API; no workflow, receipt or command changed.
- [x] Agent-native pack: accepted agent-native review findings are fixed or explicitly rejected with reason. No findings.

Completion Gates:
| Gate | Applies | Required action | Evidence |
|------|---------|-----------------|----------|
| Named verification threshold | yes | Run the command, proof, source audit, or artifact check named in this plan | See Verification evidence |
| Exact per-PR task ownership | yes | Record the exact PR and dedicated plan, or the not-yet-created single-PR slice | #473, this dedicated plan |
| Pre-solution issue challenge verdict | yes | Record reporter claim, suggested fix, repro verdict, validity verdict, durable boundary, and hard-stop/pivot decision before implementation | Recorded above |
| Repro escalation ladder | yes | For bug/behavior claims, record test/source-level, automated browser/integration, Browser, and screenshot/visual-proof outcomes or N/A/blocker reasons before `not reproduced` | (d) reproduced by unit test; other rungs N/A with reason |
| Bug reproduced before fix | yes | Record failing test/repro or N/A with reason | `client.test.ts` with `main`'s `client.ts`: 13 pass, 1 fail, exit 1 |
| Targeted behavior verification | yes | Run focused test/proof for changed behavior or record N/A | 144 pass, 0 fail across the 6 focused test files at the final head (142 after round 5, 135 after round 4, 128 after round 3, 126 after round 2, 106 after round 1, 94 before it) |
| TypeScript or typed config changed | yes | Run relevant typecheck | `bun --cwd packages/kitcn typecheck` exit 0 |
| Package exports or file layout changed | yes | Run the relevant package build before final verification and keep generated updates | `bun --cwd packages/kitcn build` exit 0; no generated updates |
| Package manifests, lockfile, or install graph changed | no | Run `bun install` and relevant package checks | N/A: no manifest or lockfile change |
| Agent rules or skills changed | yes | Run `bun install` and verify generated skill sync | Skill source `packages/kitcn/skills/kitcn/references/features/{auth,react}.md` changed; mirror synced with `bun tooling/sync-kitcn-skill.ts` (the owner command per `.agents/AGENTS.md`); no `.agents/rules/**` change, so no `bun install` regeneration applies; `bun run intent:validate` "all passed", `bun run intent:stale` "All skills up-to-date" |
| Workspace authority proof | yes | Run verification in the owning repo/package/app/route/tool and record cwd; do not count the wrong workspace as proof | All commands run at the kitcn repo root on `feat/optimistic-auth-gate` |
| Browser surface changed | no | Capture Browser Use proof or record explicit waiver/blocker | N/A: no rendered UI |
| Browser final proof | no | Attach screenshot or exact browser verification caveat when browser proof applies | N/A: no rendered UI |
| UI walkthrough | no | If UI or rendered output changed, run `.agents/skills/walkthrough/SKILL.md` after final proof and show annotated images in the final handoff; otherwise record N/A | N/A: no rendered output |
| Scaffold or fixture output changed | no | Run `bun run fixtures:sync` and `bun run fixtures:check`, or record N/A | N/A: no scaffold change; `fixtures:check` drift is external and reproduces on `main` (see Verification evidence); not synced here |
| Package behavior or public API changed | yes | Add a changeset or record why no changeset applies | `.changeset/optimistic-auth-gate.md` (patch) |
| Docs and kitcn skill sync changed | yes | Keep `www/**` and `packages/kitcn/skills/kitcn/**` in sync, or record N/A | `www/content/docs/auth/client.mdx` and `react/mutations.mdx` mirrored in `packages/kitcn/skills/kitcn/references/features/auth.md` and `react.md`; `bun tooling/sync-kitcn-skill.ts` synced `.agents/skills/kitcn`; `bun run intent:validate` "all passed", `bun run intent:stale` "All skills up-to-date" |
| Docs or content changed | yes | For docs-heavy work, use `--template docs`; for incidental docs, verify source-backed claims, links, examples, and rendered output or record N/A | Incidental docs: every claim sourced from the provider and hook JSDoc and tests; latest-state wording, no changelog language |
| High-risk mini gate | yes | For public API/runtime/package-boundary/browser/agent-action/command-contract changes, record realistic failure mode, proof plan, and why the chosen boundary is right; otherwise N/A | See High-risk note |
| Agent-native review for agent/tooling changes | yes | For `.agents/**`, `.claude/**`, `.codex/**`, skills, hooks, commands, prompts, or user-action tooling, load `.agents/skills/agent-native-reviewer/SKILL.md` and close accepted/actionable findings, or record N/A | Loaded and run; verdict PASS, no findings (see Agent-native review) |
| Local install corruption suspected | yes | Run `bun install` once, rerun the exact failing command, or record N/A | Reinstalled with the pinned Bun 1.3.9; the Bun 1.4.1 failures do not reproduce (see Error attempts) |
| Commit created | yes | For verified code-changing work, stage the entire current checkout per repo policy and create a commit; N/A only for no local patch, explicit user decline, analytical/blocked/inconclusive work, or recorded external blocker | On top of 424a3bec: JSDoc fix, test isolation fix, docs, plan; fix round 1: runtime fixes, test hygiene, docs, plan; fix round 2: three runtime fix commits, docs, plan |
| PR create or update | handed-off | For verified code-changing work, run `check`, push, create or update the PR, and sync PR body to the task-style final handoff; N/A only for no local patch, explicit user decline, analytical/blocked/inconclusive work, or recorded external blocker | PR #473 exists; `bun check` run (exit 1 on the pre-existing fixture drift only); push and body application reserved by the requester, pending |
| Task-style PR body verified | handed-off | Verify the PR body with `gh pr view --json body`; it must preserve auto-release blocks when applicable, must not include a current-PR self-link, and must use the PR #270 emoji format: `🐛 Fixes ...`, `🟢 95-100% confidence`, `Phase / 🧪 Tests / 🌐 Browser` table, and bold emoji Outcome/Caveat/Design/Verified sections | Pending: replacement body drafted locally; `gh pr view 473 --json body` read-back after the requester applies it |
| PR task evidence verified | handed-off | Verify body plan line, plan at PR head, and exact PR ownership | Pending: draft body has one plan line and this plan names #473; live check of the plan at the pushed head after the requester pushes |
| PR proof image hosting | no | If PR body needs browser proof, replace local image paths with hosted GitHub URLs or record N/A | N/A: no images |
| GitHub issue sync-back | no | Post concise issue sync after PR exists, or record N/A/blocker | N/A: no issue |
| Final handoff contract | yes | Fill the final handoff fields below with exact PR/issue/confidence/tests/browser/outcome/caveats/design/verification content or N/A reason | Filled below |
| Final lint | yes | Run `bun lint:fix` or scoped equivalent | Round 4: `bun lint:fix` exit 0, 978 files, no fixes applied, source unchanged; eslint clean inside `bun check` |
| Output budget discipline | yes | Verify no unbounded high-volume command output was streamed, or record the accidental output and recovery | Logs to `/tmp`, summaries only |
| Timed checkpoint | no | If duration was requested, keep improving until elapsed, then finish the current loop cleanly; otherwise N/A | N/A: no duration |
| Autoreview for non-trivial implementation changes | blocked | Load `.agents/skills/autoreview/SKILL.md`; use dirty local `--mode local`, branch/PR `--mode branch --base <base>`, or committed slice `--mode commit --commit <ref>` until no accepted/actionable findings, or record N/A for docs-only/trivial/no local patch | Loaded; `.agents/skills/autoreview/scripts/autoreview --mode branch --base upstream/main` exit 1: "TruffleHog is required but was not found"; the skill forbids auto-install, so this needs a human. Substitute evidence (not a replacement for autoreview): three independent Codex review lanes (standards, spec, adversarial) on `upstream/main..01a55371`, findings dispositioned under Review fixes |
| Goal plan complete | yes | Run `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-optimistic-auth-gate.md` | `[autogoal] complete` |
| Public API / package boundary proof | yes | Source-audit public API, exports, and package boundary impact | Optional props and option only; one new exported type `ConvexOptimisticUpdateOption`; no removed or renamed export |
| Convex bundle/import proof | no | Audit affected function-entry static graphs or record N/A | N/A: client and SSR entries; type-only `convex/browser` import |
| CLI/scaffold/generated proof | no | Prove command contract and regenerate owned output or record N/A | N/A: none touched |
| Release artifact classification | yes | Record whether the change is published package behavior/API/types/config/runtime or no published user-visible delta | Published package API and runtime |
| Published package changeset | yes | If published package users see a delta, load `changeset` and add/update one `.changeset/*.md` per package | One `kitcn` patch changeset, kept |
| No release artifact | no | If no artifact is needed, record the exact reason: internal-only, docs-only, agent-only, test-only, or no user-visible delta from `main` | N/A: a changeset exists |
| Package typecheck/build/test | yes | Run owning package checks or record N/A with reason | typecheck 0, build 0, focused tests pass |
| Fixture/scaffold generation | no | Run `bun run fixtures:sync` and `bun run fixtures:check` when scaffold output changed, otherwise N/A | N/A: no scaffold change |
| Docs/package skill sync | yes | Synchronize current-state public guidance or record N/A | Four provider props and `optimisticUpdate` documented in `www/` and the published kitcn skill; intent validate and stale pass |
| Docs source-backed claim audit | yes | Verify docs claims against current source or record N/A | Each claim checked against `convex-auth-provider.tsx` and `use-query-options.ts` after fix round 1: SSR admission, restore skip, identity-less rule, terminal trip, first-render baseline read, getter null, `withOptimisticUpdate` forwarding |
| Docs links / routes / previews | yes | Verify leaf links, routes, anchors, and preview names or record N/A | Same-page anchors `#optimistic-updates` and `#mutationoptions-1` match headings; no new routes or previews |
| Docs MDX/content parser | yes | Run the relevant `www` docs parser/build for MDX/content changes, or record N/A | Both edited pages compiled with `@mdx-js/mdx` 3.1.1 + `remark-gfm` (the installed fumadocs-mdx toolchain): `ok` for both, exit 0; a full `next build` of `www` was not run |
| Kitcn docs sync | yes | If `www/**` changed, update matching `packages/kitcn/skills/kitcn/**` content or record N/A | `references/features/auth.md` and `react.md` updated in the same commits and synced to `.agents/skills/kitcn` |
| Agent source / generated sync | yes | Run `bun install` when `.agents/rules/**` changed and verify generated mirrors | No `.agents/rules/**` change; `bun tooling/sync-kitcn-skill.ts` synced the mirror; `git diff` shows source and mirror identical |
| Installed lock audit | no | Verify expected lock entries and removed skills through CLI-managed state | N/A: no installed skill added, updated or removed; `skills-lock.json` untouched |
| Agent action discoverability | yes | Source-audit the skill/rule path an agent will read | `packages/kitcn/skills/kitcn/SKILL.md` lines 487 and 495 route to `references/features/react.md` and `auth.md`, where the options are documented |
| Helper and template smoke | no | Syntax-check helpers and prove incomplete failure/completed representation when applicable | N/A: no helper, script or template changed |
| Agent-native review | yes | Load `.agents/skills/agent-native-reviewer/SKILL.md` and close accepted findings, or record N/A | PASS, no findings (see Agent-native review) |

Phase / pass table:
| Phase | Status | Evidence | Next |
|-------|--------|----------|------|
| Intake and source read | done | PR body, comments, close/reopen events | reproduction |
| Reproduction | done | Item (d) red: 13 pass, 1 fail | verification |
| Implementation | done | Predated the plan (07b5927f, 8f756193, 424a3bec; historical); first pass added the JSDoc fix, test isolation fix and docs; review rounds 1 to 3 changed runtime code | verification |
| Verification | done | Focused tests, typecheck, build, lint:fix, bun check (see evidence) | closeout |
| Review fix round 1 | done | F1-F11 dispositioned; F1-F6 behavioural red then green; F7 act warnings measured (46 to 0) and spy cleanup a structural fix; F8-F11 document and workflow audits | delta review |
| Review fix round 2 | done | R1-R5 behavioural red then green (R4 also green on the pre-round-1 parent); R6-R7 document audits; two items declined with rationale; R1, R2 and R5 designs replaced in round 3 | delta review |
| Review fix round 6 | done | V1-V2 behavioural red then green; V3-V4 document audits | delta review |
| Review fix round 5 | done | U1-U4 behavioural red then green; U5-U6 document audits | delta review |
| Review fix round 4 | done | T1-T2 behavioural red then green; T3-T4 document audits | delta review |
| Review fix round 3 | done | S1-S3 behavioural red then green; S4 document audit; net `convex-auth-provider.tsx` delta vs af7117e8: 74 added, 77 removed | delta review |
| Commit / PR / GitHub sync | handed-off | Commits local; push, body application and live read-back reserved by the requester | requester |
| Closeout | blocked | Pre-existing `fixtures:check` drift; autoreview needs TruffleHog; `test:runtime` not run locally | requester |

Findings:
- The implementation splits cleanly by file (auth provider + context;
  mutation options; server client): each part compiled and passed its own
  tests without the others in a local proof, so no cross-file dependency.
- `package-entrypoints.integration.test.tsx` needs `packages/kitcn/dist`
  (`Cannot find module 'kitcn/auth/client'` before the first build).
- Under Bun 1.4.1, 12 CLI tests and one `reconcile auth schema` test fail on
  `main` too; under the pinned Bun 1.3.9 they pass.
- JSDoc placement: in `crpc-types.ts` the JSDoc "Decorated mutation
  procedure with mutationOptions and mutationKey methods." sat above the new
  `ConvexOptimisticUpdateOption` type instead of `DecorateMutation`. Moved
  back onto `DecorateMutation` in its own commit (no behaviour change).
- Test contamination (defect in this PR's proof, found by `bun check`): the
  full `test:bun` run gave 1471 pass, 2 fail. The two new `client.test.ts`
  server-mode tests failed with `this.serverHttpClient.consistentQuery is
  not a function` at `client.ts:751`; alone they pass 14/14. Repro:
  `bun test packages/kitcn/src/auth-start/index.retry.test.ts
  packages/kitcn/src/react/client.test.ts` gave 13 pass, 2 fail.
  Root cause: `auth-start/index.retry.test.ts` (on `main` already) replaced
  `convex/browser` with `mock.module`, a process-global stub
  `ConvexHttpClient` without `consistentQuery`. The older `client.test.ts`
  tests assign `serverHttpClient` by hand; the new ones construct through
  the real `convex/browser`, so they received the stub.
  Fix: `index.retry.test.ts` now spies on the real
  `ConvexHttpClient.prototype` (`setAuth`, `setFetchOptions`, `query`,
  `mutation`, `action`) with `spyOn`, restored by its existing
  `mock.restore()`. The fix sits outside the original diff because that file
  owns the leak: kitcn's `testing` skill says "`mock.module()` is
  process-global - use `spyOn()` instead", so the durable owner is the
  leaking test, not a workaround in the new tests. Same test name, same
  single test, same three assertions.
  Proof: the retry test alone 1 pass (1 before); the two-file repro 15 pass,
  0 fail; full suite in Verification evidence.
- Remaining `mock.module` calls in the package (`../auth/internal/token` x3,
  `convex/nextjs` x2, `@tanstack/react-start/server` x2, `execa` x1) target
  modules `react/client.ts` does not import, so they cannot reach these
  tests; not converted (out of scope). No other `mock.module('convex/browser')`
  exists.

Decisions and tradeoffs:
- Classification: `task`, not `major-task`. One package (`packages/kitcn`),
  additive, opt-in, default-off options plus an ordinary bug fix;
  `major-task`'s "Do Not Use" list covers one-package features and ordinary
  bugs.
- Plan adoption: per the maintainer's reopen note, the existing branch is
  adopted as is; the plan is added on top, history untouched.
- TDD: the implementation predates this plan. Item (d) red/green was replayed
  by swapping `main`'s `client.ts` in and out; the feature items are proven
  by their tests and by the unchanged default (except item 3: cRPC HTTP
  headers use the provider's fetcher for every auth provider).
- Changeset verdict: kept unchanged. `.changeset/optimistic-auth-gate.md` is
  the only unreleased changeset in the PR and none exists on `main`, so the
  reuse rule is met (it is this PR's living draft). All changes are
  non-breaking, so `patch` is the skill's level. It has separate `Features`
  and `Patches` sections, action-verb bullets and no file paths. The HTTP
  header bullet ("Improve ...") sits under Features because it is the part of
  the identity guard that covers HTTP requests; the skill does not require
  moving it.

Design rationale:
- `optimisticAuth`: removes the one socket round trip every hard load with an
  SSR token spends before auth-bound queries subscribe. Alternatives: keep the
  wait (status quo, the cost this removes); default-on (rejected: changes
  behaviour for every existing app). Safety: `setAuth` sends `Authenticate`
  before any query in the same flush and the backend orders a socket's
  messages. The PR's probe of a self-hosted backend (convex 1.45) with a
  garbage token, a bad-signature JWT and a revoked-session JWT: a refused
  token gets `AuthError` and the socket is closed before the queued queries
  are evaluated; on reconnect the query set replays under the re-established
  auth; a revoked-session JWT authenticates and the app's own per-call check
  refuses the queries. So the gate cannot show data the token was not
  entitled to.
- `onTokenIdentityChange`: a sign-in in another tab makes a refresh return a
  token for another user or session, and Convex resumes its queued mutations
  (with optimistic updates) under it: one account's write sent as another.
  Alternatives: reset auth-bound queries on identity change (rejected: the
  queued writes are already resumed); compare after caching (rejected: Convex
  already holds the token). Chosen: refuse inside the token fetcher before
  caching, trip terminally (clear the token, publish unauthenticated, call
  `client.close()`, whose semantics govern queued work), answer null afterwards,
  and let the app reload.
- `tokenIdentityBaseline`: an app that mounts the provider once per route group
  remounts it within one document, often with no SSR token, so the guard
  would re-seed from the first token it obtains, which may be another
  identity. Alternatives: hoist one provider above all route groups (not
  always possible with per-group layouts); module-level guard state holding
  per-token refusal memory or a single guard shared by every provider
  (rejected: shared across clients and tests). This is distinct from what
  review rounds 3 to 6 implemented: a browser-only page-wide trip flag and
  page identity (`react/identity-guard-trip.ts`), never set on the server,
  alongside each provider's own guard. Chosen: the app passes the identity the
  document already speaks for.
- Getter and `onTokenIdentityAdmitted`: React `<Activity>` keeps a hidden
  provider mounted with its cached token, so a value read at first render
  cannot see that the document has moved identity. A getter is read at every
  admission, cached tokens included; `onTokenIdentityAdmitted` lets the
  document record an identity at the moment a token is handed out, before
  Convex or HTTP headers receive it. Alternative: read the token store after
  the fact (rejected: races the hand-out).
- `optimisticUpdate`: forwarded to Convex's `withOptimisticUpdate`. Convex's
  local store is what `ConvexQueryClient` reads, and applying and rolling
  back the update are Convex's behaviour (the test proves the forwarding,
  not Convex's rollback). Alternative: TanStack `onMutate` plus
  `setQueryData` on Convex data (rejected: overwritten by the next
  subscription update, hand-written rollback).
- Server logger: reuse the Convex client's logger rather than cache one server
  client per process, which would mix requests' auth and consistent-query
  snapshots.

High-risk note:
- Failure modes: the guard refuses a legitimate same-session refresh (false
  trip, forced reload) or admits another identity; the HTTP header path
  (item 3, active for every app with an auth provider) sends a different
  token than before; `optimisticUpdate` leaks into TanStack options; the
  logger fix breaks per-request isolation.
- Proof: provider tests cover same-session refresh, other-identity refusal
  (first fetch, refresh, cached token after the document moved), no caching
  of a refused token, null after trip and callback counts; `context.test.tsx`
  covers the guarded header token and null after a trip; the header path
  still sends the cached token while it has 60 s or more left (the fetcher
  answers from the same cache) and force-refreshes under 60 s, as before;
  the hook test covers the pass-through; the interleaved A, B, A Start test
  covers isolation.
- Boundary: each change sits at the one owner every caller goes through.

Agent-native review:
- Verdict: PASS.
- Capability map:
  | User action | Agent route | Source owner | Mirror/lock/doc | Proof | Status |
  |---|---|---|---|---|---|
  | Configure `optimisticAuth` and the identity guard props | kitcn skill `references/features/auth.md` (routed from `SKILL.md`) | `packages/kitcn/skills/kitcn/references/features/auth.md`; runtime in `convex-auth-provider.tsx` | `.agents/skills/kitcn/...` via `bun tooling/sync-kitcn-skill.ts`; `www/content/docs/auth/client.mdx` | provider tests (identity guard admission, optimisticAuth), `intent:validate`, `intent:stale` | pass |
  | Use `optimisticUpdate` in `mutationOptions` | kitcn skill `references/features/react.md` | `packages/kitcn/skills/kitcn/references/features/react.md`; runtime in `use-query-options.ts` | mirror as above; `www/content/docs/react/mutations.mdx` | hook forwarding test, typecheck | pass |
- Findings: none. The skill source, not the mirror, was edited; the mirror
  was regenerated by its owner command; the docs and skill state the same
  current behaviour.

Implementation notes:
- 2026-09-30, first pass (historical, up to 01a55371): no product code
  changed; commits on top of 424a3bec were the JSDoc placement
  (`crpc-types.ts`), test isolation (`auth-start/index.retry.test.ts`),
  docs (`www/` and the kitcn skill) and this plan.
- Fix round 1 (7ad73f51 to 9ed1e1a0) changed product code in
  `auth-client/convex-auth-provider.tsx`.
- Fix round 2 (3062d9ac to a9b24afa) changed product code in
  `auth-client/convex-auth-provider.tsx`, added
  `auth-client/token-refusals.ts` and `react/identity-guard-trip.ts`, and
  changed `react/auth-mutations.ts` (sign-in on a tripped store).
- Fix round 3 (4da9e7a9 to 2851a047) replaced two designs: the optimistic
  window now ends at the Convex client's first auth result (module WeakSet
  of settled clients; `token-refusals.ts` and its tests deleted), and the
  trip is one browser-only document flag with subscribers
  (`react/identity-guard-trip.ts` rewritten); sign-in mutations on a
  tripped document throw.
- Fix round 4 (a3266d4d to a7199aa5) added `react/token-gate.ts` (one
  check for every token cache write, publication and hand-out) and
  `auth-client/client-settlement.ts` (settlement recorded in the `onChange`
  Convex receives), and routed the provider and `react/auth-mutations.ts`
  through them.

Review fixes:
- Round 1 (three Codex review lanes on `upstream/main..01a55371`: standards,
  spec, adversarial; requester triage). Proof type per item: F1-F6
  behavioural tests, red against 01a55371 for the intended reasons (9 of 10
  in one run plus the seeded-token case separately) and green after; the
  one test that passed in the red run, `a held SSR token of the baseline
  identity still opens the optimistic gate`, is a control that passes
  before and after by design. F7: act wrapping measured (46 warning lines
  to 0); spy cleanup in `finally` is a structural fix that a passing run
  cannot detect. F8-F11: document and workflow audits.
  - F1 fixed: SSR token admitted before it is published (withheld and the
    guard tripped when refused); a persisted session token is not restored
    while an identity is established; the optimistic gate opens only for a
    token the guard would admit. Tests: `a held SSR token of another
    identity never opens the optimistic gate and trips the guard`, `a held
    SSR token of the baseline identity still opens the optimistic gate`, `a
    token seeded into the store opens the optimistic gate only if the guard
    would admit it`, `a persisted session token is not restored while an
    identity is established` (renamed in round 2 to `an opaque persisted
    session token is not restored while an identity is established`).
  - F2 fixed: a fresh token is admitted, announced and cached in one step.
    Test: `concurrent first tokens: the losing identity is never cached`.
  - F3 fixed: a trip clears the token and publishes `isAuthenticated: false,
    isLoading: false` (the transition `CRPCProviderInner` resets on); the
    gate is terminal after a trip. Test: `a trip publishes a terminal
    unauthenticated state that Convex cannot reopen` (optimisticAuth off).
  - F4 fixed (mechanism superseded in round 3 by the client window, S1):
    a refused token must never reopen the gate. Test: `a token Convex
    refused never reopens the optimistic gate, even after another refusal`
    (real re-confirmations via `useConvexAuthRecovery`), kept as a
    regression; the store-flag test it replaces is narrowed to `a refused
    token closes the gate`.
  - F5 fixed: `client.close()` runs before `onTokenIdentityChange`; a throw
    is logged. Test: `a throwing onTokenIdentityChange still closes the
    client`.
  - F6 fixed: with an identity established, an identity-less JWT is refused;
    before one, it is handed out and announced without setting it. Tests:
    `with an identity established, a JWT without one is refused`, `an
    admitted identity refuses a later JWT without one`, `before any
    identity, a JWT without one is handed out and announced without setting
    it`.
  - F7 fixed: identity tests fetch inside awaited `act` (0 act warnings in
    the identity describes, was 46 lines); the `Math.random` spy is restored
    in `finally`.
  - F8 fixed: docs and agent-native packs applied; N/A rows corrected;
    agent-native review run (PASS); autoreview attempted and blocked on
    TruffleHog (needs a human).
  - F9 fixed: closeout is recorded as blocked, not complete; push, body
    application and live read-back are recorded as requester-reserved.
  - F10 fixed: docs and skill state first-render baseline reads, getter null,
    admitted-identity constraint, what a trip publishes, the identity-less
    rule, and that the guard governs the token kitcn supplies, not an
    app-set `Authorization` header.
  - F11 fixed: plan, docs, changeset and body claim forwarding to
    `withOptimisticUpdate` and a `client.close()` call, not store rollback
    or queued-work disposal.
  - Adversarial 5 declined by the requester: an `Authorization` header the
    app configures in `httpOptions.headers` is app-supplied, unchanged from
    before the PR and outside the guard's contract; one docs sentence says
    so.

- Round 2 (two Codex verification lanes on round 1: auth runtime and the
  rest; requester triage). F1, F2, F5, F6 and F7 verified by the lanes.
  - R1 fixed (980beef5; mechanism superseded in round 3 by S1),
    behavioural: a refusal hidden behind Convex's transparent retry (refuse
    A, SDK refetches and sends B, refuse B, one `onChange(false)`) must not
    let A reopen the gate. Test, renamed in round 4 to `a refusal hidden
    behind the SDK's transparent retry never reopens the gate`, runs through
    Convex's own `AuthenticationManager`; red at 9ed1e1a0 on the final
    assertion (A reopened the gate); kept as a regression.
  - R2 fixed (3062d9ac), behavioural: a trip is recorded per Convex client
    and per auth store (`react/identity-guard-trip.ts`); a later provider
    over a tripped client starts tripped without re-running the callback or
    `close()`; sign-in mutations publish nothing to a tripped store. Tests
    `a later provider over a tripped client starts tripped` and `a sign-in
    after a trip publishes neither a token nor authenticated`, both red at
    9ed1e1a0.
  - R3 fixed (3062d9ac), behavioural: the hydration fallback writes nothing
    back after a trip. Test `nothing writes a token back after a trip, not
    even the hydration fallback`, red at 9ed1e1a0 (token A written back).
  - R4 fixed (371bfb48), behavioural: while an identity is established, a
    persisted JWT for the same user and session is restored; another
    identity's JWT and opaque credentials are not. Test `a persisted JWT of
    the established identity is restored` was red at 980beef5 and passes on the pre-round-1 provider (01a55371), as it does
    again now; `a persisted JWT of another identity is not restored` and
    `an opaque persisted session token is not restored while an identity is
    established` fail on 01a55371 and pass now.
  - R5 (980beef5; superseded in round 3 by S1): the bounded store it fixed
    was deleted with its unit tests; no current behaviour depends on it.
  - R6 fixed (a9b24afa), document audit: "while an identity is established"
    in `client.mdx`; changeset states an identity-less first JWT
    establishes nothing; docs, JSDoc, skill mirrors and changeset describe
    the per-client terminal trip, the restore rules and retry refusals.
  - R7 fixed (af7117e8), document audit: proof types distinguished per
    item, historical snapshots labelled, the stale "No product code
    changed" dated.
  - Declined, all-options-off equivalence for HTTP headers: item 3
    deliberately routes cRPC HTTP headers through the provider's fetcher for
    every auth provider, not only when the new props are set, so the
    identity guard and any future fetcher policy cover HTTP. With no guard
    the fetcher answers from the same 60 s cache as before. The body's What
    3 and Design say this is unconditional.
  - Declined, removing rollback wording: kept, but every mention (mutations
    page, API table, skill mirrors, changeset, body) now attributes applying
    and rolling back the update to Convex's `withOptimisticUpdate`
    semantics; the test proves forwarding only.

- Round 3 (two Codex verification lanes on round 2; requester ruling: a
  simplification, not more patches). R3, R4, R6 wording and R7 labelling
  verified. Residual R1 (a confirmation clearing pending tokens), R2 (trip
  tied to the old client; an already-mounted provider missing the trip) and
  a new cap-eviction reopen all came from per-token refusal bookkeeping and
  per-client trip state, so both designs were replaced. Red log:
  `kitcn-1596-bodies/round3-red.log` (6 fail at af7117e8; the hard-load
  control passes).
  - S1 fixed (4da9e7a9), behavioural: the optimistic window lasts only until
    the Convex client reports its first auth result (confirmed, or refused
    while confirming a held token), tracked per client in a module WeakSet;
    afterwards the gate follows Convex's confirmed state for the client's
    lifetime. `TokenRefusals`, the pending-token bookkeeping and their tests
    are deleted. Tests `a refused token after a prior confirmation never
    reopens the gate` (through `AuthenticationManager`: confirm A, refresh
    B, refuse B, retry C, refuse C, recover B), `no number of refusals lets a
    refused token reopen the gate` (17 refusals) and `a remount over a
    client that already reported auth gets no optimism`, all red at
    af7117e8; the round 1 and 2 refusal tests stay as regressions and the
    hard-load test `opens the gate on a held, unexpired JWT before Convex
    confirms it` stays green.
  - S2 fixed (b9ce7220), behavioural: one browser-only document flag
    (`typeof window` guarded, never set on the server) with subscribers;
    every mounted provider quarantines on the flip (token cleared,
    unauthenticated published); the token fetcher reads the flag at call
    time, so Convex and HTTP headers get null; a provider or client created
    later starts tripped. Tests `a remount with a fresh client cannot reopen
    the document after a trip` and `two mounted providers sharing a client:
    tripping one quarantines the other`, both red at af7117e8. The
    concurrent-first-tokens test now expects both hand-outs null (B's
    refusal trips the document) while still proving B is never published.
    `resetDocumentTripForTests` runs in `afterEach` so the flag never leaks
    between tests.
  - S3 fixed (b9ce7220), behavioural: sign-in, social sign-in and sign-up
    throw `AuthMutationError` code `TOKEN_IDENTITY_CHANGED` on a tripped
    document, before the request and again before publishing. Test `a
    sign-in on a tripped document surfaces an error and publishes nothing`,
    red at af7117e8 (result returned, no error).
  - S4 fixed (2851a047 and this commit), document audit: docs, JSDoc, both
    skill mirrors, changeset, plan and body describe the window as "until
    the client's first auth result" and the trip as per document; refusal
    memory and its cap are gone from docs, JSDoc, skill mirrors, changeset
    and body, and the plan mentions them only in dated review history
    labelled as superseded (round 4 grep); acceptance criterion 8 and the
    body carve out item 3; historical claims labelled.

- Round 4 (two Codex verification lanes on round 3; requester ruling: fix
  the shape, one token choke point, settlement at the source). Every earlier
  probe passes at b0b588ff. Red log: `kitcn-1596-bodies/round4-red.log` (7
  fail at b0b588ff).
  - T1 fixed (a3266d4d), behavioural: `react/token-gate.ts` is the one check
    every token passes at the moment it is cached, published or handed out:
    the document trip first (whatever the provider's options), then the
    provider's identity admission (registered per auth store; refusing
    another identity trips the document). Callers: the provider fetcher's
    fresh path and hand-out (after every await), the persisted restore, the
    hydration write-back, and auth mutations' returned-token seeding and
    `isAuthenticated` publication; the waiting-for-auth loop fails with
    `TOKEN_IDENTITY_CHANGED` on a trip instead of timing out. The SSR
    `initialToken` is judged by the same identity rule before the store is
    hydrated (a store write cannot precede hydration). Duplicated caller
    checks were removed. Tests, all red at b0b588ff: `an in-flight fetch in
    an unguarded provider hands out nothing after a trip`, `a trip during a
    sign-in, sign-up or social sign-in fails it before anything is
    published` (all three methods), `waiting for auth after a sign-in fails
    at once when the document trips` (was `AUTH_STATE_TIMEOUT` after 5 s),
    `a JWT a sign-in returns for another identity is refused and trips the
    document`. A persisted JWT of another identity now trips the document
    too (same rule); its test still passes.
  - T2 fixed (aa22f269), behavioural: `auth-client/client-settlement.ts`
    wraps the client's `setAuth` once so the `onChange` Convex receives
    records settlement and notifies every provider over that client
    (`useSyncExternalStore`); the React-effect marking is removed, so a
    local session change settles nothing. Tests, all red at b0b588ff: `a
    client's auth result reported before React commits still ends its
    optimistic window` (false and true), `one provider's refusal ends the
    optimistic window of another over the same client`, `losing the local
    session does not end a fresh client optimistic window`. (Superseded by the
    round 4 addendum f9011f87: the wrapper was first installed for every
    `ConvexAuthProvider` mount; it is now installed only with
    `optimisticAuth`.)
  - T3 fixed (a7199aa5), document audit: `isAuthenticated`, `useIsAuth` and
    `<Authenticated>` in `client.mdx` and the skill mirror are qualified for
    the optimistic window (server still enforces auth); the token gate and
    the sign-in refusal are documented in docs, JSDoc, mirror and changeset.
  - Round 4 addendum (f9011f87), behavioural: the settlement wrapper is
    installed only when a provider has `optimisticAuth`; without it the
    Convex client is left untouched (no own property); installation is
    idempotent and never double-wraps. Test `the settlement wrapper is
    installed only with optimisticAuth, once`, red before on the props-off
    assertion (`kitcn-1596-bodies/round5-red.log`). Supported-configuration
    rule, documented in `client.mdx`, the skill mirrors and the
    `optimisticAuth` JSDoc: every provider over one Convex client uses the
    same `optimisticAuth` setting, since results reported before an
    optimistic provider mounts are not seen. Gates: provider 76 pass,
    auth-client + auth-mutations + context 100 pass, eslint and typecheck
    exit 0, `bun lint:fix` no changes.
  - T4 fixed (the round 4 plan commit), document audit: plan constraints, scope and
    non-goals restated to HEAD with the first pass labelled historical;
    item 3 carved out of the TDD note; F4, R1 and R5 history labelled
    superseded; the R1 test renamed; the body names the baseline-identity
    control as a control.

- Round 5 (two Codex verification lanes on round 4; every earlier probe
  passes; upstream provider tests 26/26). Red log:
  `kitcn-1596-bodies/round6-red.log` (6 fail at 0f2f18ef; the settlement
  probe was first made observable by publishing `false` before the stale
  write, since re-publishing an unchanged `true` notifies nobody).
  - U1 fixed (010bdec5), behavioural: `syncConvexAuthForStartLoader` holds
    tokens to the document state (`admitsDocumentToken` in
    `react/identity-guard-trip.ts`, dependency-free so the loader entry
    stays small): no token after a trip, only the identity a guard admitted
    (recorded page-wide, browser only), and again at every hand-out. Tests:
    `the Start loader hands no token to a fresh client after a trip`, `the
    Start loader refuses a token of another identity than the document
    admitted`.
  - U2 fixed (010bdec5), behavioural: HTTP headers re-admit the token right
    before attaching it, after the app's headers callback resolves. Test
    (`context.test.tsx`): `http headers carry no kitcn token when the
    document trips while app headers load`.
  - U3 fixed (010bdec5), behavioural: `AuthStateSync` reads the trip and the
    client's settlement at the write and publishes through
    `publishAuthState`. Tests: `a trip in a descendant effect is not
    overwritten by a stale optimistic publication`, `a settlement in a
    descendant effect is not overwritten by a stale optimistic
    publication`.
  - U4 fixed (010bdec5), behavioural: `publishAuthenticated` re-admits the
    store's token at that moment, so a document whose baseline moved trips
    instead of publishing authenticated. Test: `a sign-in fails if the
    document moved identity before authenticated is published`.
  - U5 fixed (the round 5 docs commit), document audit: docs, JSDoc, skill
    mirror, changeset and body state the two guarantees tested (no foreign
    token cached, published or handed out; on refusal the fetcher answers
    null, unauthenticated is published, the client is closed and the
    callback runs) and drop terminal-state promises.
  - U6 fixed (the round 5 plan commit), document audit: body rewritten to
    about 90 lines in the #459 shape with final-head counts; review history
    lives here; the round 4 wrapper paragraph labelled superseded.

- Round 6 (two Codex verification lanes on round 5; every earlier probe
  passes; upstream provider tests 26/26). Red log:
  `kitcn-1596-bodies/round7-red.log` (2 fail at 21bfad63).
  - V1 fixed (bee7ab93), behavioural: a guarded provider records the
    identity it knows at mount (baseline value, a getter's current answer,
    or its held SSR token) as the page identity, before any fetch; the
    Start loader refuses a token of another identity and trips the page.
    Test: `the Start loader refuses another identity before the provider
    fetches, from its baseline or held token` (both variants).
  - V2 fixed (bee7ab93), behavioural: the Start loader marks a client it
    authenticates as settled, so no optimistic window opens over it;
    documented (docs, mirror, JSDoc). Test: `a client the Start loader
    authenticated gets no optimistic window; a fresh one does` (with the
    fresh-client control).
  - V3 fixed (body, outside the repo), document audit: the body separates
    token admission, sign-in publication (re-admits) and auth-state
    publication (trip and settlement), and qualifies failing-test
    provenance to accepted runtime findings.
  - V4 fixed (the round 6 plan commit), document audit: the rejected
    module-level alternative is distinguished from the implemented
    page-wide trip and identity.

Error attempts:
| Error / failed attempt | Count | Next different move | Resolution |
|------------------------|-------|---------------------|------------|
| `package-entrypoints.integration.test.tsx`: Cannot find module `kitcn/auth/client` | 1 | Build the package | `bun --cwd packages/kitcn build`, rerun passes |
| `bun check` under Bun 1.4.1: 13 failures (12 in `cli/watcher`, `cli/utils/dry-run-formatter`, `cli/commands/dev`, 1 in `reconcile auth schema`), outside the diff; the CLI files fail on `upstream/main` too (36 pass, 12 fail) | 1 | Reinstall and run with the pinned Bun 1.3.9 (`packageManager`) | Same files 48 pass, 0 fail under 1.3.9; all gates recorded under 1.3.9 |
| `bun check` under 1.3.9: `test:bun` 1471 pass, 2 fail (`client.test.ts` contamination) | 1 | Isolate by pairing test files; report; fix at the leaking owner on ruling | `index.retry.test.ts` converted to `spyOn`; pair 15/0 |

Verification evidence:
- Historical snapshot, first pass (up to 01a55371). cwd: kitcn repo root,
  branch `feat/optimistic-auth-gate`; Bun 1.3.9.
- Red: `bun test packages/kitcn/src/react/client.test.ts` with `main`'s
  `client.ts`: 13 pass, 1 fail, exit 1 (expected 0 `Math.random` calls,
  received 1). Green with the PR's `client.ts`: 14 pass, 0 fail.
- Focused: `convex-auth-provider.test.tsx` 46 (26 on `main`),
  `context.test.tsx` 10 (9), `use-query-options.test.tsx` 24 (23),
  `client.test.ts` 14 (12): 94 pass, 0 fail, exit 0.
- `bun test packages/kitcn/src/auth-client packages/kitcn/src/react`: 197
  pass, 0 fail, 18 files.
- `bun --cwd packages/kitcn typecheck`: exit 0. `bun --cwd packages/kitcn
  build`: exit 0.
- Focused at HEAD with the fixes: the four files above plus
  `auth-start/index.retry.test.ts`: 95 pass, 0 fail.
- Contamination proof: `bun test packages/kitcn/src/auth-start/index.retry.test.ts
  packages/kitcn/src/react/client.test.ts` 13 pass, 2 fail before the test fix;
  15 pass, 0 fail after. Retry test alone: 1 pass before and after.
- `bun lint:fix`: exit 0, 975 files, no fixes applied, source unchanged.
- `bun check` (Bun 1.3.9, HEAD fb457e75 plus this plan): exit 1 at
  `fixtures:check` after every earlier lane passed: `bun lint` (biome 975
  files, eslint clean), `bun typecheck` 5/5 tasks, `test:bun` 1473 pass / 0
  fail (154 files), `test:vitest` 1053 pass / 14 skipped (101 files passed,
  2 skipped, no type errors), `test:cli` 124 pass / 0 fail, `test:concave`
  "Concave smoke passed".
- `fixtures:check` stops at `expo` (exit 1): the external Expo template now
  writes a different `AGENTS.md` and no `CLAUDE.md`. Reproduced on
  `upstream/main` 3250fb9c with `bun tooling/fixtures.ts check expo --backend
  concave` (exit 1). The other seven fixtures (`expo-auth`, `next`,
  `next-auth`, `start`, `start-auth`, `vite`, `vite-auth`), checked one by
  one on the same code, exit 1 only on external dependency resolution in the
  generated `package.json`: `cn` ^0.3.0 to ^0.4.0 and `lucide-react` ^1.46.0
  to ^1.48.0 or ^1.49.0. This diff touches no scaffold; not synced here.
- `test:verify` (run separately because `bun check` stops early): exit 0.
- Historical snapshot, fix round 1 (Bun 1.3.9, HEAD 9b3d4886 plus this plan):
  - Red against 01a55371: the 10 new provider tests gave 1 pass, 9 fail
    (log kept at `kitcn-1596-bodies/round1-red.log` outside the repo); the
    seeded-token case failed separately (`isAuthenticated` true).
  - Focused (`convex-auth-provider.test.tsx` 57, `context.test.tsx` 10,
    `use-query-options.test.tsx` 24, `client.test.ts` 14,
    `index.retry.test.ts` 1): 106 pass, 0 fail, exit 0, 0 `act` warnings.
  - `bun lint:fix`: exit 0, 975 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (same `expo` drift: `AGENTS.md`,
    `CLAUDE.md`) after every earlier lane passed: lint (biome 975 files,
    eslint), typecheck 5/5, `test:bun` 1484 pass / 0 fail (154 files),
    `test:vitest` 1053 pass / 14 skipped, no type errors, `test:cli` 124
    pass / 0 fail, `test:concave` "Concave smoke passed".
  - `test:verify`: exit 0.
  - `autoreview --mode branch --base upstream/main`: exit 1, TruffleHog not
    installed (blocked, needs a human).
- Historical snapshot, fix round 2 (Bun 1.3.9, HEAD a9b24afa plus this plan):
  - Red logs kept outside the repo in `kitcn-1596-bodies/round2-redA.log`
    (R2, R3: 0 pass, 3 fail at 9ed1e1a0), `round2-redB.log` (R1 red on the
    final assertion; R5 module missing), `round2-redC.log` (R4: matching JWT
    red at 980beef5; on 01a55371 it passes while the other two fail).
  - `bun --cwd packages/kitcn build`: exit 0.
  - Focused (`convex-auth-provider.test.tsx` 63, `token-refusals.test.ts`
    3, `auth-mutations.test.tsx` 11, `context.test.tsx` 10,
    `use-query-options.test.tsx` 24, `client.test.ts` 14,
    `index.retry.test.ts` 1): 126 pass, 0 fail, exit 0, 0 `act` warnings.
  - `bun lint:fix`: exit 0, 978 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (same `expo` drift: `AGENTS.md`,
    `CLAUDE.md`) after every earlier lane passed: lint (biome 978 files,
    eslint), typecheck 5/5, `test:bun` 1493 pass / 0 fail (155 files),
    `test:vitest` 1053 pass / 14 skipped, no type errors, `test:cli` 124
    pass / 0 fail, `test:concave` "Concave smoke passed".
  - `test:verify`: exit 0.
  - Docs: both edited MDX pages compile with `@mdx-js/mdx`; skill mirror
    synced; `intent:validate` "all passed", `intent:stale` "All skills
    up-to-date".
  - `check-complete.mjs`: `[autogoal] complete` (gates resolved or recorded
    as blocked or handed-off; not closure).
- Historical snapshot, fix round 3 (Bun 1.3.9, HEAD 62e2bc2c plus this plan):
  - Red log kept outside the repo in `kitcn-1596-bodies/round3-red.log`
    (6 fail at af7117e8, hard-load control passes).
  - `bun --cwd packages/kitcn build`: exit 0.
  - Focused (`convex-auth-provider.test.tsx` 68, `auth-mutations.test.tsx`
    11, `context.test.tsx` 10, `use-query-options.test.tsx` 24,
    `client.test.ts` 14, `index.retry.test.ts` 1): 128 pass, 0 fail,
    exit 0, 0 `act` warnings.
  - First `bun check` run at 2851a047 stopped at `bun lint`: eslint
    `react-hooks/rules-of-hooks` on a new test calling a hook inside an
    arrow; fixed in 62e2bc2c (hook passed by reference).
  - `bun lint:fix`: exit 0, 976 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (same `expo` drift: `AGENTS.md`,
    `CLAUDE.md`) after every earlier lane passed: lint (biome 976 files,
    eslint), typecheck 5/5, `test:bun` 1495 pass / 0 fail (154 files),
    `test:vitest` 1053 pass / 14 skipped, no type errors, `test:cli` 124
    pass / 0 fail, `test:concave` "Concave smoke passed".
  - `test:verify`: exit 0.
  - Docs: both edited MDX pages compile; skill mirror synced;
    `intent:validate` "all passed", `intent:stale` "All skills up-to-date".
  - `convex-auth-provider.tsx` vs af7117e8: 74 added, 77 removed (1224 to
    1221 lines); all non-test `packages/kitcn/src` changes vs af7117e8: 128
    added, 167 removed (`token-refusals.ts` deleted).
  - `check-complete.mjs`: `[autogoal] complete` (gates resolved or recorded
    as blocked or handed-off; not closure).
- Historical snapshot, fix round 4 (Bun 1.3.9, HEAD a7199aa5 plus this plan; predates f9011f87):
  - Red log kept outside the repo in `kitcn-1596-bodies/round4-red.log`
    (7 fail at b0b588ff).
  - `bun --cwd packages/kitcn build`: exit 0.
  - Focused (`convex-auth-provider.test.tsx` 75, `auth-mutations.test.tsx`
    11, `context.test.tsx` 10, `use-query-options.test.tsx` 24,
    `client.test.ts` 14, `index.retry.test.ts` 1): 135 pass, 0 fail,
    exit 0, 0 `act` warnings.
  - `bun lint:fix`: exit 0, 978 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (same `expo` drift: `AGENTS.md`,
    `CLAUDE.md`) after every earlier lane passed: lint (biome 978 files,
    eslint), typecheck 5/5, `test:bun` 1502 pass / 0 fail (154 files),
    `test:vitest` 1053 pass / 14 skipped, no type errors, `test:cli` 124
    pass / 0 fail, `test:concave` "Concave smoke passed".
  - `test:verify`: exit 0.
  - Docs: both edited MDX pages compile; skill mirror synced;
    `intent:validate` "all passed", `intent:stale` "All skills up-to-date".
  - Non-test `packages/kitcn/src` vs b0b588ff: 241 added, 96 removed (two
    new modules, `token-gate.ts` and `client-settlement.ts`);
    `convex-auth-provider.tsx`: 86 added, 72 removed.
  - `check-complete.mjs`: `[autogoal] complete` (gates resolved or recorded
    as blocked or handed-off; not closure).
- Historical snapshot, fix round 5 (Bun 1.3.9, HEAD 5efbbddb plus this plan):
  - `bun --cwd packages/kitcn build`: exit 0.
  - Focused (`convex-auth-provider.test.tsx` 81, `context.test.tsx` 11,
    `auth-mutations.test.tsx` 11, `use-query-options.test.tsx` 24,
    `client.test.ts` 14, `index.retry.test.ts` 1): 142 pass, 0 fail,
    exit 0, 0 `act` warnings.
  - `bun lint:fix`: exit 0, 978 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (the `expo` drift) after every
    earlier lane passed: lint (biome 978 files, eslint), typecheck 5/5,
    `test:bun` 1509 pass / 0 fail (154 files), `test:vitest` 1053 pass / 14
    skipped, no type errors, `test:cli` 124 pass / 0 fail, `test:concave`
    "Concave smoke passed".
  - `test:verify`: exit 0.
  - Docs: both edited MDX pages compile; skill mirror synced;
    `intent:validate` "all passed", `intent:stale` "All skills up-to-date".
  - `check-complete.mjs`: `[autogoal] complete` (gates resolved or recorded
    as blocked or handed-off; not closure).
- Final head (current; Bun 1.3.9, HEAD a1bc229f plus this plan):
  - `bun --cwd packages/kitcn build`: exit 0 (at 05aeda27; a1bc229f
    changes only a test).
  - Focused (`convex-auth-provider.test.tsx` 83, `context.test.tsx` 11,
    `auth-mutations.test.tsx` 11, `use-query-options.test.tsx` 24,
    `client.test.ts` 14, `index.retry.test.ts` 1): 144 pass, 0 fail,
    exit 0, 0 `act` warnings (a1bc229f wrapped the two Start-loader
    refusals in `act`).
  - `bun lint:fix`: exit 0, 978 files, no fixes applied, source unchanged.
  - `bun check`: exit 1 at `fixtures:check` (the `expo` drift) after every
    earlier lane passed: lint (biome 978 files, eslint), typecheck 5/5,
    `test:bun` 1511 pass / 0 fail (154 files), `test:vitest` 1053 pass / 14
    skipped, no type errors, `test:cli` 124 pass / 0 fail, `test:concave`
    "Concave smoke passed".
  - `test:verify`: exit 0.
  - Docs: `client.mdx` compiles; skill mirror synced; `intent:validate` "all
    passed", `intent:stale` "All skills up-to-date".
  - `check-complete.mjs`: `[autogoal] complete` (gates resolved or recorded
    as blocked or handed-off; not closure).
- `test:runtime`: not run locally. Its `expo` scenario needs port 3210,
  held on this machine by an unrelated local Docker Convex backend, so the
  readiness poll of `127.0.0.1:3210/_dashboard` answers 404 and times out
  after 60 s. Left untouched; CI owns this lane.
- `check-complete.mjs`: `[autogoal] complete`.

Source-listed case matrix:
| Case | Source claim | Harness | Before | Expected after | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gate opens on held unexpired JWT before confirmation | provider test | waits | open | pass | done |
| 2 | Gate closed without option or with expired/opaque JWT | provider test | closed | closed | pass | done |
| 3 | Refused token closes gate; no refused token reopens it through real re-confirmations | provider tests `a refused token closes the gate`, `a token Convex refused never reopens the optimistic gate` | reopened (red) | closed | pass | done |
| 4 | Other identity refused before cache; client closed; callback; later null | provider test | admitted | refused | pass | done |
| 5 | Same-session refresh passes | provider test | passes | passes | pass | done |
| 6 | HTTP headers use guarded fetcher; nothing after trip | `context.test.tsx` | cache read | guarded token | pass | done |
| 7 | `optimisticUpdate` to `withOptimisticUpdate`, not TanStack | `use-query-options.test.tsx` | absent | passed through | pass | done |
| 8 | Server construct and query call no `Math.random()` | `client.test.ts` | 1 call (red) | 0 calls | pass | done |
| 9 | Interleaved Start requests keep own auth and snapshot | `client.test.ts` | pass | pass | pass | done |
| 10 | Baseline value refuses other identity, admits same; undefined/null keep first-token behaviour | provider test | N/A | as stated | pass | done |
| 11 | Getter read at admission; cached token refused after move | provider test | N/A | as stated | pass | done |
| 12 | Admitted callback once per handed-out token, never refused or after trip; new callback used without new `setAuth` | provider test | N/A | as stated | pass | done |
| 13 | New `client.test.ts` tests pass in the full suite | `index.retry.test.ts` + `client.test.ts` pair; `test:bun` | 13 pass, 2 fail | all pass | 15/0 pair; full suite in Verification evidence | done |
| 14 | Retry test still proves the fresh-token retry | `index.retry.test.ts` alone | 1 pass | 1 pass, same assertions | 1/0 | done |
| 15 | SSR token of another identity never published, never opens the gate, trips the guard (optimisticAuth + baseline) | provider test (F1) | published, gate open (red) | withheld, closed, tripped | pass | done |
| 16 | Seeded or restored credential cannot open the gate or be used before admission | provider tests (F1) | gate open; `/get-session` sent (red) | closed; not restored | pass | done |
| 17 | Concurrent first tokens never publish the losing identity | provider test (F2) | B published (red) | never published | pass | done |
| 18 | Trip publishes terminal unauthenticated; Convex cannot reopen | provider test (F3) | stays authenticated (red) | `isAuthenticated` false, `isLoading` false, token null | pass | done |
| 19 | Throwing callback still closes the client | provider test (F5) | close 0 (red) | close 1 | pass | done |
| 20 | Identity-less JWT refused once an identity exists; announced without setting one before | provider tests (F6) | handed out, not announced (red) | as stated | pass | done |
| 21 | Refusal hidden behind Convex's transparent retry never reopens the gate | provider test through `AuthenticationManager` (R1; since S1 a regression of the client window) | A reopened the gate (red) | closed | pass | done |
| 22 | Trip terminal for the document: remount starts tripped | provider test (R2; since S2 document-level) | gate reopened (red) | stays unauthenticated | pass | done |
| 23 | Nothing writes a token back after a trip | provider test (R3) | A written back (red) | null | pass | done |
| 24 | Matching persisted JWT restored; other identity and opaque not | provider tests (R4) | matching not restored at 980beef5 (red); green on 01a55371 | as stated | pass | done |
| 30 | In-flight fetch in an unguarded provider hands out nothing after a trip | provider test (T1) | token handed out and cached (red) | null | pass | done |
| 31 | Trip during sign-in, sign-up or social sign-in fails it; nothing published | provider test (T1) | timeout or success (red) | `TOKEN_IDENTITY_CHANGED` | pass | done |
| 32 | Waiting for auth fails at once on a trip | provider test (T1) | 5 s `AUTH_STATE_TIMEOUT` (red) | immediate `TOKEN_IDENTITY_CHANGED` | pass | done |
| 33 | Sign-in-returned JWT for another identity refused, trips | provider test (T1) | published, success (red) | refused, tripped | pass | done |
| 34 | Settlement recorded where Convex reports it; shared across providers; not by local session loss | provider tests (T2) | missed or wrongly set (red) | as stated | pass | done |
| 35 | Props-off providers leave the Convex client untouched; the wrapper installs once with `optimisticAuth` | provider test (f9011f87) | own `setAuth` property (red) | prototype method; single wrap | pass | done |
| 36 | Start loader: no token after a trip or for another document identity | provider tests (U1) | token handed out (red) | unauthenticated, no `setAuth` | pass | done |
| 37 | HTTP headers re-admit after the app headers await | `context.test.tsx` (U2) | `Authorization` sent (red) | none | pass | done |
| 38 | Stale `AuthStateSync` publication after a trip or settlement | provider tests (U3) | `true` published (red) | never | pass | done |
| 39 | Authenticated publication re-admits the token | provider test (U4) | success, `true` (red) | `TOKEN_IDENTITY_CHANGED`, trip | pass | done |
| 40 | Start loader refuses another identity known from a provider's baseline or held token at mount | provider test (V1) | B handed out (red) | refused, page tripped | pass | done |
| 41 | No optimistic window over a loader-authenticated client; fresh client keeps it | provider test (V2) | window opened (red) | closed; control open | pass | done |
| 25 | Refusal memory pruned and bounded | superseded by S1: `TokenRefusals` and its tests deleted | N/A | N/A | N/A | superseded |
| 26 | Optimistic window ends at the client's first auth result; no refusal count, post-confirmation refusal or remount reopens it | provider tests (S1) | reopened (red) | closed | pass | done |
| 27 | Hard load: a fresh client with an SSR token still opens before confirmation | provider test (S1 control) | open | open | pass | done |
| 28 | Trip is document-level: fresh-client remount starts tripped; a mounted provider sharing the client is quarantined (store and fetcher) | provider tests (S2) | reopened; token handed out (red) | tripped; null | pass | done |
| 29 | Sign-in on a tripped document throws `TOKEN_IDENTITY_CHANGED` and publishes nothing | provider test (S3) | success returned (red) | error | pass | done |

Final handoff contract:
- Commit line: JSDoc fix, test isolation fix, docs and plan commits, then
  fix round 1 (runtime fixes, test hygiene, docs, plan) on
  `feat/optimistic-auth-gate` on top of 424a3bec.
- PR line: #473 (existing, reopened).
- Issue line: `🐛 Fixes ➖ N/A`
- Confidence line: `🟢 90% confidence`
- Flow table:
  - Reproduced: server logger red (1 fail); features N/A; browser N/A
  - Verified: 144 focused pass, full `test:bun` 1511/0, `bun check` lanes
    the diff can affect pass (stops at pre-existing fixture drift); browser
    N/A
- Browser check: N/A, no rendered UI.
- Outcome: opt-in optimistic auth gate and identity guard, optimisticUpdate
  pass-through, deterministic server construction.
- Caveat: socket-ordering probe from the PR, not re-run; queued-work
  disposal is Convex's `close()` semantics; external fixture drift;
  `test:runtime` not run locally; autoreview blocked on TruffleHog.
- Design:
  - Chosen boundary: the single owner of each behaviour.
  - Why not quick patch: per-consumer checks can be bypassed.
  - Why not broader change: default-on auth would change every app.
- Verified: see Verification evidence.
- PR body verified: handed off to whoever applies the draft body.

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
- Never include a line that links to the current PR itself.

Final handoff / sync:
- Commit: thirty-one local commits on `feat/optimistic-auth-gate` (four
  before review, four in fix round 1, five in fix round 2, five in fix
  round 3, six in fix round 4 including its addendum, three in fix round
  5, four in fix round 6).
- PR: #473.
- Issue: N/A.
- Browser proof: N/A.
- Caveats: probe carried over; fixture drift external; `test:runtime` not
  run locally; autoreview blocked; push, body application and live
  read-back pending with the requester.

Timeline:
- 2026-09-27 PR #473 opened with 07b5927f; 8f756193 and 424a3bec follow.
- 2026-09-29T21:54Z autoclosure comment and close; 22:11Z reopened with the
  adoption note.
- 2026-09-30 Plan created and adopted onto the branch; red/green replayed;
  focused tests, typecheck, build pass.
- 2026-09-30 `bun check` found the `client.test.ts` contamination; reported;
  on the requester's ruling fixed in `index.retry.test.ts` with `spyOn`.
  JSDoc placement fixed; docs added; `bun lint:fix` and `bun check` rerun.
- 2026-09-30 Fix round 1: three Codex review lanes; F1-F6 fixed with
  behavioural red then green, F7-F11 fixed (structural and document
  audits), adversarial 5 declined by the requester; packs applied; gates
  rerun; closeout recorded as blocked.
- 2026-09-30 Fix round 2: two verification lanes; R1-R5 fixed with
  behavioural red then green, R6-R7 document audits, two items declined
  with rationale; gates rerun.
- 2026-09-30 Fix round 3: two verification lanes; R1, R2 and R5 designs
  replaced by S1 (client window) and S2 (document trip); S3 sign-in error;
  S4 docs; gates rerun.
- 2026-09-30 Fix round 4: two verification lanes; T1 token gate, T2
  settlement at the source, T3-T4 docs and plan; gates rerun.
- 2026-09-30 Fix round 5: two verification lanes; U1-U4 through the gate
  (Start loader, HTTP headers, auth state, authenticated publication); U5
  narrowed contract; U6 short body; full gates at the final head.
- 2026-09-30 Fix round 6: V1 page identity at mount, V2 loader settles its
  client, V3-V4 wording; full gates at the final head.

Reboot status:
| Question | Answer |
|----------|--------|
| Where am I? | Closeout blocked on the pre-existing fixture drift and autoreview; fix rounds 1 to 6 committed locally |
| Where am I going? | Requester delta review, push, PR body application, live read-back; maintainer review |
| What is the goal? | Per-PR task evidence and proof for #473 |
| What have I learned? | See Findings |
| What have I done? | See Timeline |

Open risks:
- The socket-ordering premise rests on the PR's probe of a self-hosted
  backend (convex 1.45); not re-run.
- `fixtures:check` fails on `main` too from external drift (`cn`,
  `lucide-react` ranges, Expo template); CI will report it until `main` is
  resynced.
- `test:runtime` (auth scenarios included) did not run on this machine; CI
  should cover it.
- Other `mock.module` calls remain in the package (none on modules
  `react/client.ts` imports); they can still contaminate other files.
- Autoreview has not run (TruffleHog missing locally).
- While an identity is established, only a persisted JWT for that identity
  is restored; an opaque persisted credential is not (the Better Auth
  session path is unaffected). Round 2 restored same-identity JWT
  continuity (R4).
- The trip is one browser-only module flag, so it lasts for the document's
  lifetime by design (a reload or an HMR module replacement clears it);
  the optimistic window is tracked in a module WeakSet of settled Convex
  clients.

Hard closeout guard:
- A local-only final response for verified code-changing work is invalid unless
  this plan records an explicit user decline, no local patch, analytical/
  blocked/inconclusive outcome, or a real commit/PR blocker. Recorded: the PR
  exists and the requester reserved the push of this plan commit.
