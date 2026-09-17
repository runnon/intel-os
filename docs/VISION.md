# Long-term vision

Theater Picture is the first app. The long-term goal is a **platform for building and
deploying unit-specific tools that are born accreditation-ready for restricted US
government networks** — a "Base44 / Lovable for the DoD," where a unit can stand up the
small, specific tool it needs without a two-year program of record and without violating
a single security control.

This document states that goal, explains the security terrain it has to survive, names
who else is in the space, and gives an honest read on whether it's a good idea. It is
strategy, not a spec — nothing here is a requirement ID and nothing here overrides
`AGENTS.md`.

## The problem we're actually attacking

The bottleneck for software in a military unit is almost never the software. A watch
floor's tracker, a squadron's readiness board, an intel shop's link chart, a logistics
cell's parts tracker — each is a few weeks of work for one competent developer. What
kills them is the surrounding machinery: getting anything onto NIPRNet requires an
**Authority to Operate (ATO)**, and earning an ATO the traditional way is a months-to-
years paperwork exercise that a unit cannot run on its own. So units either do without,
or they smuggle the workflow into a spreadsheet, a SharePoint list, or an unsanctioned
commercial SaaS tool that the network is supposed to block.

The opportunity is to make the accreditation the platform's problem, not the app's. If a
platform holds the hard security posture — the hosting, the controls, the continuous
monitoring, the authorization boundary — then each individual app inherits it and ships
in days. That is exactly the model commercial low-code platforms (Base44, Retool,
Lovable) already proved in the civilian world. Nobody has made the *government-network*
version genuinely easy, because the accreditation wall is real and most builders never
learn to climb it.

## The security terrain: what "NIPRNet-ready" actually means

"NIPRNet" is not a single security level; it's a network that carries data at several
sensitivity tiers. Getting this vocabulary right is the whole game, so the platform's
docs — and its agents — need it exact.

### The two networks

- **NIPRNet** (Non-classified Internet Protocol Router Network) — the DoD's sensitive-
  but-unclassified backbone. Carries everything from public info up through **Controlled
  Unclassified Information (CUI)**. This is our target: everything Theater Picture does is
  designed to live here.
- **SIPRNet** — the SECRET-level classified network. A different, physically separate
  world (Impact Level 6). Explicitly **out of scope** — the moment a tool needs SIPRNet,
  it is a different product with different rules. Our IL2-clean discipline (MARK-4) is
  what keeps us on the right side of that line.

### Impact Levels (DoD Cloud Computing SRG)

DISA's **Cloud Computing Security Requirements Guide (CC SRG)** classifies a cloud
workload by the sensitivity of the data it holds and the damage its compromise would
cause. These are the tiers that matter on NIPRNet:

| Level | Data it may hold | Rough bar |
|------|------------------|-----------|
| **IL2** | Public / non-critical unclassified. | Public-facing; low bar. **Theater Picture lives here today.** |
| **IL4** | **CUI** — export-controlled, PII, PHI, most operational data. | The workhorse tier for real unit tools. FedRAMP Moderate + DoD-specific controls. |
| **IL5** | Higher-sensitivity CUI, mission-critical data, some unclassified National Security Systems. | Stricter tenant separation; the ceiling for unclassified. |
| IL6 | Classified up to SECRET. | SIPRNet only — **out of scope.** |

The platform's job is to make **IL4/IL5** the boundary the platform holds, so an app
author only ever reasons at IL2-style simplicity: "public info in, public info out."
Theater Picture is deliberately built at IL2 first — the cleanest possible proof that the
pattern holds — with the architecture kept swappable so the same app could be dropped
into an IL4/IL5 boundary without a rewrite (single env-var tile source, self-hostable
everything, no revocable third-party runtime dependency — see NFR-4/NFR-5 and
`DECISIONS.md`).

### The accreditation machinery

- **RMF** (Risk Management Framework, NIST 800-37) — the six/seven-step process by which a
  system earns the right to operate. It produces the evidence package an Authorizing
  Official signs.
- **ATO** (Authority to Operate) — the signed risk-acceptance decision. Traditionally a
  point-in-time assessment valid up to three years; earning the first one is the wall.
- **cATO** (Continuous ATO) — the modern model, and the one that makes a *platform* viable.
  Instead of re-authorizing each app from scratch, an accredited platform with mature
  continuous monitoring, active cyber defense, and a DevSecOps pipeline can authorize new
  software *inside its existing boundary* continuously. **cATO is the mechanism that turns
  "every app needs its own two-year ATO" into "the platform is authorized once and apps
  inherit it."** This is the single most important concept for the vision.
- **BCAP** (Boundary Cloud Access Point) — the guarded gateway through which cloud
  workloads connect back to NIPRNet. Being reachable from a unit means living behind one.
- **Software factory** — an accredited DevSecOps pipeline (Platform One / Big Bang,
  the Air Force's Kessel Run, the Army's, the Navy's Black Pearl, etc.). **Iron Bank** is
  Platform One's hardened container registry. These exist precisely because the ATO wall
  is the bottleneck; they are proof the DoD already believes in this model.

## Who else is trying this

Being honest about the field: the accreditation-as-a-platform idea is **not** novel, and
that's reassuring, not disqualifying — it means the market and the DoD have validated the
shape. But the specific slice we're aiming at is genuinely underserved.

- **Second Front — Game Warden.** The closest analog. A DevSecOps PaaS with a **DISA
  Provisional Authorization at IL5** and FedRAMP in-process, whose whole pitch is
  "deploy mission software to the DoD in ~90 days" by inheriting their accreditation
  boundary. This is the platform layer of our vision, already real. But Game Warden
  serves **software vendors shipping a finished app** — you bring an accredited-ready
  container, they get it to the warfighter. It is not a place a lieutenant builds a tool.
- **Platform One / Kessel Run / Black Pearl.** Government-run software factories. They
  supply the accredited pipeline, but you still need a program, developers, and a place in
  the queue. Not self-service, not citizen-developer.
- **Palantir (Foundry/AIP), Anduril (Lattice).** Heavy, integrator-scale platforms for
  large mission systems and data integration. Enormously capable, enormously expensive,
  and aimed at the opposite end from "a squadron needs a small tracker this month."
- **Commercial low-code (Base44, Retool, Microsoft Power Apps on GCC High).** Power
  Apps genuinely reaches IL4/IL5 via GCC High and is the *real* incumbent for
  build-it-yourself gov tools — but it's clunky, license-gated, tenant-bound, and not
  open. Base44/Retool are easy but have no government-network accreditation story at all.

**The gap:** nobody pairs *Base44-grade ease-of-authoring* with *Game-Warden-grade
accreditation inheritance*, as *open source*, aimed at the *unit* rather than the vendor
or the program office. That intersection is the bet.

## Where Theater Picture fits

Theater Picture is not a detour from the platform — it's the **reference app and the
credibility proof**. It demonstrates, end to end, that a useful unit tool can be built
under exactly the constraints the platform will have to enforce for everyone:

- IL2-clean by construction (MARK-4), public sources only (`assertPublicSource`).
- No revocable third-party runtime dependency; every hosted service swappable via one env
  var (NFR-4/NFR-5) — the discipline that lets the same app move up to an IL4/IL5 boundary.
- Immutable, serial-addressable records (AUTO-10) and a hard wall between reported fact
  and analytic judgement (AUTO-5) — the kind of provenance and safety property an
  Authorizing Official actually cares about.
- Plain-GitHub governance, MIT license — auditable by anyone, owned by no vendor.

Every invariant in `AGENTS.md` is really a **platform-readiness rule wearing an app's
clothes.** Holding this one app to them is how we learn the pattern that a hundred apps
will inherit.

## Is this a good idea?

Short version: **the vision is sound and the timing is good; the risk is entirely in
execution, specifically in the accreditation moat.**

**What's genuinely right about it.** The pain is real and universal — every unit has the
"we just need a small tool and can't get it fielded" problem. The DoD has already blessed
the underlying mechanics (software factories, cATO, JWCC), so we're rowing downstream on
policy. Game Warden's existence de-risks the platform thesis while leaving the
self-service/unit-level/open slice open. And the AI-assisted-authoring wave is exactly
what could collapse "a few weeks for one developer" into "an afternoon for a motivated
captain" — which is the only thing that makes the *unit-level* version, as opposed to the
vendor-level version, newly possible.

**What's genuinely hard, and shouldn't be sugarcoated.**
- **The moat is the accreditation, and it's expensive and slow to build.** An IL4/IL5
  authorization is a serious, capital- and time-intensive undertaking. Until we hold one
  (or ride inside someone else's boundary — e.g. building *on* Game Warden or a software
  factory rather than beside it), we are a nice open-source app, not a platform. The
  fastest credible path to "platform" is probably to inherit an existing boundary first.
- **Self-service authorization is in tension with security.** The whole value is letting
  non-experts ship; the whole risk is that non-experts ship something unsafe. The platform
  has to make the safe path the only path — templated data handling, enforced markings,
  no raw network egress — which is real product-design work, not a wrapper.
- **Adoption inside the DoD is political, not just technical.** Getting a unit to actually
  use a tool touches ownership, funding colors, and the local ISSM's comfort. Open source
  and IL2-clean lower that barrier but don't remove it.

**The honest verdict.** This is a good idea with a hard, well-understood moat — which is
the *good* kind of hard, because the difficulty itself is the defensibility. If it were
easy, Retool would already own it. The right way to de-risk it is exactly what we're
doing: prove the disciplined-app pattern with Theater Picture at IL2, keep every
architectural choice swappable toward IL4/IL5, and treat the eventual platform as
"productize these constraints for other builders" rather than "invent them." The next
concrete question isn't technical — it's whether the first platform boundary is one we
build or one we borrow.

## Near-term markers that this is working

- Theater Picture stays IL2-clean and NFR-4/5-swappable with zero exceptions (proof the
  discipline is sustainable, not aspirational).
- A **second** app is built on the same constraints and shares real code with the first
  (proof the pattern generalizes — the moment "app" starts becoming "platform").
- A written path exists from our architecture to an IL4/IL5 boundary (own or inherited),
  even before we walk it.

---
*This is a living strategy note. Record decisions that change direction in
[`DECISIONS.md`](./DECISIONS.md); this file states where we're pointed, not what we've
committed to build.*
