# Theater Picture as "GitHub for Situational Awareness"

How GitHub's collaboration model maps onto an open OSINT system, and the architecture
required to support it. Written 2026-09-15 against GitHub's actual permission mechanics
(verified: [repository roles docs](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)).

## 1. How GitHub actually works (the parts that matter)

**The unit of ownership is the repository**, owned by a user or an organization.
Five repository roles, in ascending trust:

| Role | Can do | Cannot do |
|---|---|---|
| **Read** | View, discuss, open issues | Change anything |
| **Triage** | Label, close, organize issues/PRs | Push or merge |
| **Write** | Push branches, merge PRs | Change settings |
| **Maintain** | Manage settings, bypass some protections | Destructive/security actions |
| **Admin** | Everything incl. branch protection, deletion, access control | — |

**The critical insight: you don't need push access to contribute.** Anyone can fork a
public repo, make changes in their fork, and open a **pull request**. The PR is reviewed
in public — discussion, requested changes, approvals — and only someone with Write+ can
merge it into the canonical branch. Trust is earned socially and visibly: good PRs →
Triage → Write. The contribution graph *is* the résumé.

**Quality is enforced by machines before humans:** branch protection on `main` requires
(a) changes arrive via PR, (b) N approving reviews, (c) **required status checks** (CI)
pass, (d) optionally review from **CODEOWNERS** (path-based mandatory reviewers), and
(e) optionally **signed commits** (cryptographic author identity). Admin sets these
rules; even Write users cannot bypass them.

**Provenance is structural:** every change is a commit with an author and timestamp;
history is append-only; `blame` answers "who added this and when" for every line.
**Releases/tags** are immutable, addressable snapshots. **Forks** mean disagreement
doesn't require permission — you can maintain your own divergent copy, with lineage
preserved.

## 2. The mapping

| GitHub | Theater Picture |
|---|---|
| Repository | **A situation/watch** (e.g. `centcom/iran-theater`) — the event stream + collection config + gazetteer for one picture |
| Organization | A command's community, an NGO, a newsroom — owns multiple situations |
| `main` branch | **The published picture** — what renders on the map and in issues |
| Commit | An event submission or revision (author, timestamp, diff — our `event_revisions` table already models this) |
| Pull request | **A proposed event or correction** with evidence attached ("this strike was at 26.79N not 27.1N; two more sources") |
| PR review | **Verification** — human reviewers check sourcing, placement, attribution before it enters the picture |
| Required status checks | **Our pipeline guards as CI**: public-source check (MARK-4), gazetteer validation (DATA-2), dedup scan (AUTO-2), schema validation, confidence-rule lint (ANL-2). A submission that fails checks cannot merge — mechanically |
| CODEOWNERS | **Desk reviewers** — maritime events require the maritime desk's approval; Iran events require the Iran desk |
| Signed commits | **The analyst signature** — the spec's assessment layer (AUTO-6: publishes only over a named signature) is literally commit signing by a verified identity |
| Branch protection | The rule that *nothing* enters the published picture without checks + review — even maintainers |
| Bot accounts (dependabot) | **Our 12-hour ingest worker** — a bot that opens auto-submissions from feeds; machine collection and human contribution flow through the same reviewed pipe (or: bot events auto-merge when checks pass, flagged as machine-sourced) |
| Releases/tags | **Issues (SU-CEN-26-00N)** — already immutable, serial-addressable snapshots (AUTO-10). Identical concept |
| Fork | **An alternative picture** — disagree with a watch's editorial line? Fork it, maintain your own, lineage preserved. Competing assessments coexist without gatekeeping fights |
| Issues/Discussions | Per-event discussion threads — dispute attribution, attach evidence |
| Contribution graph / blame | **Analyst reputation** — public, per-event provenance; "who put this dot on the map" is always answerable |

## 3. Roles for Theater Picture

| Role | Who | Can |
|---|---|---|
| **Reader** | Everyone, no account | View everything — pictures, issues, sources, discussion. The public-good layer |
| **Contributor** | Anyone with an account | Propose events/corrections (PR-equivalent), discuss. No trust required — the review gate is the defense |
| **Triager** | Proven contributors | Label, dedupe-flag, request changes, close junk submissions |
| **Maintainer** (Write/Maintain) | The watch's trusted core | Merge submissions into the published picture; edit collection config (feeds, gazetteer, GDELT queries) |
| **Owner** (Admin) | Whoever stood the watch up | Access control, protection rules, the signer list, archive/transfer |

**How someone gains push access — the GitHub social ladder, unchanged:** contribute
good submissions in public → get Triage → demonstrate judgment → get Write. The
history of your merged contributions is public and auditable, so trust decisions are
evidence-based. Two OSINT-specific additions:

1. **Identity tiers.** Pseudonymous accounts can contribute (review gates quality);
   **signing an assessment requires a verified real identity** (the spec's named-analyst
   rule). Optional org verification (e.g. confirmed .mil/.gov affiliation) as a display
   badge, never a requirement to participate.
2. **Adversarial pressure is the design case, not the edge case.** A public OSINT commons
   will attract deliberate poisoning (fake events, attribution manipulation). GitHub's
   answer maps directly: nothing merges without checks + review, provenance on every
   merged item names both author and approver, rate limits on new accounts, and the
   audit log is public. The cost of poisoning the picture is high and the blast radius
   of a bad merge is a visible, revertible commit — not silent corruption.

## 4. Technical architecture (evolution of the current stack)

Current state already has the load-bearing pieces: append-only `event_revisions`
(commits), immutable `issues` (releases), public read via RLS (public repos), and pure
validation functions in `packages/core` (the future status checks).

To add, in order:

1. **Auth + membership** — Supabase Auth (GitHub OAuth, fittingly). New tables:
   `profiles`, `situations` (the repo object: slug, owner, config), `situation_members`
   (user, situation, role). RLS policies express the role matrix.
2. **Submissions (the PR object)** — `submissions` table: proposed event payload or
   revision-diff, evidence URLs, author, status (`draft → checks → review → merged |
   rejected`), discussion thread. The web UI grows a "Propose event" flow and a review
   queue.
3. **Checks runner** — on submission, run the existing core functions
   (`assertPublicSource`, `geolocate`, `dedupe` against the live picture, schema
   validation) and record per-check pass/fail on the submission. Merge button is
   disabled until green — branch protection as a database constraint.
4. **Merge transaction** — applies the proposal to `events` + writes `event_revisions`
   + records merger identity. Every dot on the map traces to a submission, an author,
   checks results, and an approver.
5. **The worker becomes a bot contributor** — same submission pipe, auto-merge on green
   checks, `author = ingest-bot`, so machine and human content have identical provenance
   structure.
6. **Signing** — assessments (Phase 2) require a signature from the situation's signer
   list; store signature + verified identity on the assessment record. Sigstore-style
   keyless signing or GPG later; verified-identity-plus-audit-log first.
7. **Forking** — copy-on-write of a situation's config + pointer to the parent; events
   reference their origin situation. Cheap to add once situations are first-class rows.

## 5. What NOT to copy from GitHub

- **Git itself.** Events are structured rows, not text files; diffing/merging JSON events
  in actual git buys pain, not provenance. Model the *semantics* (append-only history,
  reviewed merges, signed releases) in Postgres.
- **Branches beyond main-plus-proposals.** One published picture per situation, plus
  pending submissions, covers the need. Full branch topology is complexity without a user.
- **Org-wide base permissions** at first — per-situation roles only, until there are
  real multi-situation organizations.
