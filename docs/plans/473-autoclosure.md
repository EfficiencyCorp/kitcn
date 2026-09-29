# Autoclose PR 473

Objective:
Autoclose PR #473 without expanding its contract. Recover the missing exact-PR
task evidence, verify the package and auth behavior, close all live P1-or-higher
feedback, pass the repository gate, and merge only the verified head.

Flow mode:
one-shot execution

Goal plan:
docs/plans/473-autoclosure.md

Template:
docs/plans/templates/autoclosure.md

Primary template:
docs/plans/templates/autoclosure.md

Applied packs:
- agent-native (docs/plans/templates/packs/agent-native.md)

Linked plans:
- [PR #473 task recovery](docs/plans/473-optimistic-auth-gate.md) - owns the
  exact PR contract, package proof, task-style PR body, and task evidence.

User requirements:
- Run the repaired `autoclosure` workflow on PR #473 now.
- Preserve and continue partially good work. Close only when no usable task
  state exists.
- Merge only when the recovered PR is genuinely ready.

Completion threshold:
- PR #473 has exactly one task-plan line. The linked task plan exists at the
  live head and names PR #473.
- Every linked-plan and closure-matrix gate is complete or N/A with evidence.
- Focused package tests, the `packages/kitcn` build, `bun lint:fix`, and
  `bun check` pass on the final committed head.
- The final feedback inventory has zero actionable P1-or-higher items. Every
  lower-priority item has an explicit user deferral or a concrete non-actionable
  verdict.
- The terminal receipt binds its proof to the exact live head. A guarded merge
  lands that head in `main`, and GitHub reports the PR as merged.
- No new product scope. Completion requires every applicable lane below to have
  fresh evidence, `bun check` passing, review findings closed, authorized
  GitHub delivery complete, and the goal checker passing.

Verification surface:
- Immutable-head and local `HEAD` equality checks for PR #473.
- Focused auth-provider, React context, query-options, and server-client tests.
- `bun --cwd packages/kitcn build`, package typecheck if available,
  `bun lint:fix`, and `bun check` from the PR worktree.
- `resolve-pr-feedback` helper output plus raw top-level, review-body, and
  GraphQL thread inventories.
- `gh pr view` body/check/head read-back, terminal receipt read-back, guarded
  merge result, and fetched `main` history.

Constraints:
- Finish the intended delta; do not invent the next feature.
- Preserve source/generated/package/docs ownership.
- Use a different diagnostic after repeated failure signatures.

Boundaries:
- intended delta: the optimistic auth gate, JWT identity guard, guarded HTTP
  token source, Convex optimistic mutation passthrough, and deterministic
  server-client construction described by PR #473
- allowed repairs: the existing `packages/kitcn` code and tests, its changeset,
  these two exact-PR plans, and the PR body or feedback receipts
- unrelated files: preserve; do not treat as blockers
- non-goals: new auth features, stack topology changes, base retargets, broad
  migrations, deployment, or changes to the repaired autoclosure workflow

Output budget strategy:
- Read exact files and bounded diffs. Count or save broad feedback and test
  output before inspecting slices. Exclude `node_modules`, generated build
  output, coverage, and `tmp` unless a named proof requires them.

Blocked condition:
- Stop only if the contributor branch cannot accept the required evidence,
  GitHub feedback cannot be fetched or read back, a required check needs an
  external authorization, or repeated distinct repairs reproduce the same
  environment failure.

Start Gates:
| Gate | Applies | Evidence |
| --- | --- | --- |
| Immutable PR head fetched | yes | `refs/pr/473` = live `headRefOid` = `424a3bec59d8c9b1accf592ad534ef73ad90e7dc` |
| Task intake classified | yes | `recoverable`; detailed PR body, three coherent commits, and ten related package files provide a concrete contract, but the body has no task-plan line |
| Complete task evidence verified | yes | GitHub head, fetched `refs/pr/473`, and local `HEAD` all equal `29f558fbfd5ff37222d30d006a9fbee24744e9a1`; the plan exists at that head and the body has exactly one matching task-plan line |
| Recoverable task state adopted | yes | Preserved branch, exact-PR plan, recovery fix, task-format body, and immutable-head read-back are live |
| Active source/plan reconstructed | yes | PR #473 body, commits, changed paths, comments, and checks read from GitHub; immutable head fetched locally |
| Intended delta and exclusions recorded | yes | Boundaries above mirror the PR contract and forbid new product scope or topology changes |
| Closure matrix classified | yes | Package/API, changeset, source behavior, feedback, review, repository check, and GitHub delivery apply; fixtures, UI, and agent workflow are currently N/A |
| Live PR feedback target resolved | yes | PR #473 at recovered head `29f558fbfd5ff37222d30d006a9fbee24744e9a1` |
| Feedback proof checkout bound to PR head | yes | Local `HEAD`, fetched PR ref, and live OID matched before feedback review |
| Unfiltered feedback inventory | conditional | Recovery is complete; refresh every feedback surface next |
| GitHub delivery expectation recorded | yes | Recover exact-PR evidence, push to `EfficiencyCorp:feat/optimistic-auth-gate`, verify, then merge only with an exact-head guard |
| Active goal checked or created | yes | Active goal points to this plan and names the task-evidence, feedback, proof, check, merge, and receipt threshold |
| Agent-native pack selected | yes | Required by the autoclosure goal contract |
| Agent-facing action surface identified | no | The PR does not change rules, skills, prompts, commands, or agent actions; the plan only records this run |
| Source rule versus generated mirror boundary identified | no | No agent source or generated mirror belongs to PR #473 |
| Installed-skill lock versus local-rule owner identified | no | No installed skill or lock state belongs to PR #473 |
| `agent-native-reviewer` loaded or waiver recorded | no | N/A because the PR does not change agent or tooling behavior |

Closure matrix:
| Lane | Applies | Owner/proof | Status |
| --- | --- | --- | --- |
| task intake classification | yes | immutable-head `recoverable` evidence | complete |
| per-PR task ownership | yes | recovered exact PR + dedicated task plan | complete |
| recoverable task adoption | yes | preserved branch + exact-PR `task` + repaired evidence read-back | complete |
| absent-state close | conditional | exact missing-state comment + `CLOSED` read-back | pending |
| source behavior | pending | pending | pending |
| package/API/build | pending | pending | pending |
| generated output | pending | pending | pending |
| fixtures/scenarios | pending | pending | pending |
| docs/package skill | pending | pending | pending |
| changeset | pending | pending | pending |
| agent workflow | pending | pending | pending |
| live PR feedback | conditional | complete/recovered: `resolve-pr-feedback` + final P1 read-back; absent: N/A with comment/CLOSED receipts | pending |
| cleanup/review | pending | pending | pending |
| repository check | yes | `bun check` | pending |
| GitHub delivery | pending | pending | pending |

Work Checklist:
- [x] **Declare the mode and resolve the forge before any poll.** Mode is
      `drive`. `origin` CLI is unavailable, so this run uses GitHub CLI.
- [x] **Work the merge frontier and nothing above it.** PR #473 is the only
      frontier.
- [x] **One babysitter per stack.** No other task or worktree is attached to
      this PR in the current chat.
- [x] **Never mutate stack topology.** This run preserves `main` as the base
      and `feat/optimistic-auth-gate` as the contributor head.
- [ ] **Order is conflicts, then review threads, then CI.** Run after exact-PR
      evidence reaches the live head.
- [ ] **Trust the active forge's verdict, not a green check list.** Use the
      GitHub watcher after recovery.
- [ ] **Classify CI before any retrigger.** No retry has been requested.
- [ ] **Bugbot is triaged skeptically, always.** No Bugbot item is known yet.
- [ ] **Stop at the human's line.** The user authorized autoclosure and merge,
      but no scope expansion or protection bypass.
- [x] **Resolve the forge and dependency chain.** GitHub is the forge. PR #473
      is a single PR from `EfficiencyCorp:feat/optimistic-auth-gate` to `main`.
- [ ] **Verify each PR independently.** The current agent did not author the
      contributor's code and will issue the verdict directly. A higher-priority
      runtime rule forbids spawning the playbook's verifier subagent.
- [ ] **Find the contiguous verified run.** The run contains only PR #473.
- [ ] **Cancel pending merges before changing the chain.** Inspect before any
      topology write. No topology write is planned.
- [ ] **Prepare only the bottom PR.** PR #473 is the bottom and only PR.
- [ ] **Reassess the evidence.** Bind review and tests to the final head and
      base OID.
- [ ] **Merge with a service-enforced head condition.** Use GitHub's
      `--match-head-commit` guard after every gate passes.
- [ ] **Arm future merging only with durable verification gates.** Skip future
      arming. This run will use an immediate guarded merge.
- [ ] **Watch the frontier and preserve its verdict.** Rearm after each push.
- [ ] **Confirm the landing before advancing.** Read the merged state and
      confirm the merge commit is in fetched `main`.
- [ ] **Stop at the ceiling.** The ceiling is PR #473.
- [ ] Every PR has its own `task` invocation and dedicated task plan; a batch
      plan or aggregate autoclosure is not used as a substitute.
- [ ] Bounded intake classified immutable-head task state as `complete`,
      `recoverable`, or `absent` from source-backed intent plus delta coherence;
      incomplete evidence alone was not classified as absent.
- [ ] Recoverable work was preserved and adopted through `task` for the exact
      PR; its dedicated plan/body evidence was committed, pushed, and read back
      at the new head before normal closeout continued.
- [ ] Complete or recovered task evidence was verified from the PR body,
      fetched head, and exact PR ownership. Absent state instead has the exact
      missing-state comment and `CLOSED` read-back, and no full review, merge,
      or release work continued.
- [ ] Intended behavior and exclusions are reconstructed from real sources.
- [ ] Each lane is proven or N/A with a concrete reason.
- [ ] Generated output was changed through its owner and regenerated.
- [ ] Package/docs/skill/fixture/scenario/changeset contracts are synchronized.
- [ ] Full `resolve-pr-feedback` ran for the exact complete or recovered PR;
      every
      actionable P1-or-higher finding was fixed, proved, replied to, and
      resolved or received the required top-level reply receipt.
- [ ] For a complete or recovered PR, local committed `HEAD`, fetched PR ref,
      and live `headRefOid` matched before proof/reply/resolution and after
      every push.
      For an absent-state PR, this and all feedback gates are N/A with the exact
      missing-state comment and `CLOSED` receipts.
- [ ] Unfiltered top-level PR comments and review bodies were fetched through
      the GitHub API, compared by ID/URL with helper output, and every excluded
      bot/author item was ledgered; identity alone never dismissed feedback.
      Only the exact terminal receipt produced/read back by this run is exempt
      from the versioned ledger.
- [ ] All inline review threads were fetched with GraphQL cursor pagination
      without filtering resolved/outdated items; every thread has priority,
      rationale, relocation, and proof state in the ledger.
- [ ] Every actionable feedback item has a persisted P0-P3 priority and
      one-sentence rationale from the autoclosure rubric; ambiguous P1-versus-
      lower items fail closed as P1.
- [ ] Every P1-or-higher proof reran after the final material branch push,
      regardless of file type, including resolved or outdated threads that
      disappear from the helper's unresolved-thread output.
- [ ] Feedback was re-fetched after the last push/reply/resolution and shows
      zero unresolved actionable P1-or-higher findings.
- [ ] After all versioned plan/source updates were pushed, the exact-head P1
      proof/read-back receipt was posted to the PR and read back; no terminal
      receipt-only branch push was created. A post-comment `headRefOid` fetch
      matches the OID recorded in that receipt, and a post-comment helper/raw
      feedback fetch still shows zero actionable P1-or-higher items and no new
      URL lacking a verdict or explicit deferral, except the verified receipt.
- [ ] Any remaining P2-or-lower item has its exact URL plus the user's explicit
      priority deferral recorded; no feedback was silently ignored.
- [ ] Accepted cleanup and review findings are closed.
- [ ] PR body and check state match the final evidence.
- [ ] Residual blocker/waiver has exact evidence and next owner.
- [ ] Agent-native pack: source-of-truth rule files are edited instead of generated skill mirrors.
- [ ] Agent-native pack: the changed agent action is discoverable from the skill/rule text.
- [ ] Agent-native pack: generated mirrors are synced when `.agents/rules/**` changed, or N/A reason is recorded.
- [ ] Agent-native pack: installed skills are changed only through
      `npx skills add/update/remove`; local rules/templates/helpers stay source-owned.
- [ ] Agent-native pack: routing, required receipts, placeholder failure,
      completion representability, and forbidden behavior have eval/smoke rows.
- [ ] Agent-native pack: accepted agent-native review findings are fixed or explicitly rejected with reason.

Error attempts:
| Failure signature | Count | Next different move | Resolution |
| --- | ---: | --- | --- |
| `bun check` cannot resolve `kitcn/auth/*` from `convex` before package artifacts exist | 1 | Build the package because package exports and artifacts are in scope, then rerun the exact gate | Resolved. The package build passed and the next check reached the test suite. |
| Full Bun suite fails the two changed server-client tests after `auth-start/index.retry.test.ts` | 1 | Run the contaminator and victim together, then replace process-global module mocks with file-scoped spies | Resolved. The two-file repro changed from two failures to 15 passes. |
| `fixtures:check` regenerates Expo SDK 55 guidance that differs from committed fixture snapshots | 1 | Do not add unrelated scaffold drift to PR #473. Ask whether to waive the gate or authorize a separate fixture repair. | Resolved for this PR by the user's `go` at 2026-09-30T00:58:19+02:00. The waiver applies only to this unrelated fixture lane. |

Completion Gates:
| Gate | Applies | Required action | Evidence |
| --- | --- | --- | --- |
| Task intake classification | pending | Record immutable-head `complete`, `recoverable`, or `absent` sources and rationale | pending |
| Per-PR task ownership | pending | Record exact PR and complete or recovered task-plan path | pending |
| Recoverable task adoption | conditional | Preserve current work, run exact-PR `task`, repair plan/body evidence, and read back at new head | pending |
| Absent-state disposition | conditional | Name the missing usable state, comment, close, and read back | pending |
| Targeted behavior proof | pending | Run smallest missing owning proof | pending |
| Source/generated audit | pending | Prove correct source and regenerated mirrors | pending |
| Package/docs/scenario closure | pending | Run every applicable local contract | pending |
| Feedback proof checkout | conditional | Complete or recovered PR only: require local committed `HEAD` = fetched PR ref = live `headRefOid` before proof/reply/resolution and at terminal verification | pending |
| Live PR feedback resolution | conditional | Complete or recovered PR only: run full `resolve-pr-feedback` and close every actionable P1-or-higher finding; otherwise N/A with absent-state stop receipts | pending |
| Feedback priority classification | conditional | Complete or recovered PR only: persist P0-P3 plus rationale for every actionable item; classify ambiguous P1-versus-lower as P1 | pending |
| Final P1 proof replay | conditional | Complete or recovered PR only: after the final material branch push, rerun every P1-or-higher proof, including resolved/outdated items | pending |
| Final live feedback read-back | conditional | Complete or recovered PR only: re-fetch helper plus unfiltered top-level/all-thread inventories; require zero actionable P1-or-higher and explicit P2-or-lower deferrals | pending |
| External terminal receipt | conditional | Complete or recovered PR only: post/read exact-head receipt; require receipt/live/fetched/local OID equality and no unrecorded helper/raw URL except that verified receipt | pending |
| Deslop | pending | Run bounded cleanup or N/A | pending |
| Agent-native reviewer | pending | Run for workflow changes or N/A | pending |
| Final lint | yes | Run `bun lint:fix` | pending |
| Repository check | yes | Run `bun check` | pending |
| GitHub delivery | pending | Commit/push/open or update PR and read back | pending |
| Autoreview | yes | Resolve every accepted actionable finding | pending |
| Goal plan complete | yes | Run `node .agents/skills/autogoal/scripts/check-complete.mjs docs/plans/473-autoclosure.md` | pending |
| Agent source / generated sync | pending | Run `bun install` when `.agents/rules/**` changed and verify generated mirrors | pending |
| Installed lock audit | pending | Verify expected lock entries and removed skills through CLI-managed state | pending |
| Agent action discoverability | pending | Source-audit the skill/rule path an agent will read | pending |
| Helper and template smoke | pending | Syntax-check helpers and prove incomplete failure/completed representation when applicable | pending |
| Agent-native review | pending | Load `.agents/skills/agent-native-reviewer/SKILL.md` and close accepted findings, or record N/A | pending |

Phase / pass table:
| Phase | Status | Evidence | Next |
| --- | --- | --- | --- |
| Inventory | complete | immutable head, PR source, comments, checks, and recoverable classification recorded | task evidence repair |
| Repair | complete | recovery commit and task-format body are live; local/fetched/live heads match | feedback and source review |
| Review/checks | in_progress | | delivery |
| Delivery | pending | | final audit |
| Closeout | pending | | final |

Verification evidence:
- `bun --cwd packages/kitcn build` from the PR worktree passed.
- `bun --cwd packages/kitcn typecheck` passed.
- `bun test packages/kitcn/src/auth-start/index.retry.test.ts packages/kitcn/src/react/client.test.ts` failed before the test-isolation fix with two missing-`consistentQuery` errors, then passed with 15 tests.
- The full Bun suite inside `bun check` passed with 1,473 tests after the fix.
- `bun check` remains red only in `fixtures:check`. Expo's live SDK 55 template changed generated `AGENTS.md` and removed `CLAUDE.md`. The immutable PR diff contains no fixture, CLI registry, or tooling change.

Timeline:
- 2026-09-29T22:35:42.520Z Autoclosure plan created.
- 2026-09-30T00:39:00+02:00 `bun check` passed lint and package typechecks but
  stopped in `convex` because the fresh worktree had no `packages/kitcn` build
  artifacts. Package export proof requires the build, so the next move is
  `bun --cwd packages/kitcn build` followed by the same gate.
- 2026-09-30T00:45:45+02:00 The package build, package typecheck, focused
  contaminator-victim test, and all 1,473 Bun tests pass. The repository gate
  stops only on live Expo template drift outside PR #473.
- 2026-09-30T00:49:29+02:00 Revalidated the clean local recovery commit and
  unchanged live PR head. The fixture runner delegates Expo creation to
  `create-expo-app@latest` with the moving `default@sdk-55` tag. No open repo
  issue or PR owns the resulting guidance drift. Fixing that generator contract
  would be a separate CLI task, not an in-scope repair for PR #473.
- 2026-09-30T00:50:11+02:00 Read the active `main` ruleset. It requires the
  `CI` status, one code-owner approval, approval after the last push, and an
  extra approval for unattributed changes. The current account can bypass the
  ruleset, but Shipping forbids `--admin`; a human approval remains a later
  wait rather than a defect to code around.
- 2026-09-30T00:50:53+02:00 Third consecutive goal turn revalidated a clean
  local recovery commit, unchanged live PR head, red `bun check` fixture lane,
  and no explicit waiver. The blocked audit is satisfied.
- 2026-09-30T00:58:19+02:00 The user said `go`, explicitly waiving only the
  unrelated Expo fixture lane. Recovery resumed. This does not authorize an
  admin merge bypass or unrelated fixture changes.
- 2026-09-30T01:00:00+02:00 Recovery commit
  `29f558fbfd5ff37222d30d006a9fbee24744e9a1` reached the contributor branch.
  GitHub head, fetched `refs/pr/473`, and local `HEAD` matched; the live body
  contained exactly one task-plan line and the plan existed at that head.

Reboot status:
| Question | Answer |
| --- | --- |
| Where am I? | Recovery is complete; live feedback and source review are active. |
| Where am I going? | Push exact task evidence, then review, feedback, final checks, guarded merge, and final audit. |
| What is the goal? | Merge only a fully recovered and verified PR #473. |
| What have I learned? | The PR is recoverable. Its test suite had one process-global mock leak. The remaining check failure is unrelated Expo fixture drift. |
| What have I done? | Created exact-PR plans, fixed the test leak, passed focused tests, package build, package typecheck, lint, and the full Bun suite. |

Open risks:
- `bun check` is not green because the external Expo template no longer matches
  committed fixture guidance. The user explicitly waived only that unrelated
  lane for PR #473; all other gates remain mandatory.
- GitHub still reports Vercel failure because the contributor deployment needs
  udecode team authorization. Vercel is not the required ruleset context; `CI`
  is required and should rerun after a permitted push.
- The `main` ruleset requires a code-owner approval after the final push. This
  run will not use the account's available bypass.

Resolved blocker receipt:
- Attempted: installed dependencies, built `packages/kitcn`, fixed the
  deterministic suite contamination, reran focused tests, package typecheck,
  lint, and the full repository gate across three goal turns.
- Evidence: 15 focused tests and all 1,473 Bun tests pass. `bun check` stops
  only when the moving Expo SDK 55 template changes generated guidance outside
  PR #473. Live PR head remains `424a3bec59d8c9b1accf592ad534ef73ad90e7dc`.
- Previous blocker: repo policy forbade updating the PR with a failing
  `bun check`, and autoclosure forbade adding unrelated fixture or CLI scope.
- Resolution: the user's `go` at 2026-09-30T00:58:19+02:00 explicitly waives
  only the unrelated Expo fixture lane for PR #473. A code-owner approval will
  still be required after the final push.
- Live PR feedback review has not begun because the recovery evidence has not
  reached the PR head.
