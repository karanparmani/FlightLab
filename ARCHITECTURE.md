# Flightlab MVP design

## Curriculum inspection
Inspected the ten images retrievable from the referenced conversation (the preview reports eleven). They specify service blueprints for passengers/drivers; service architecture and scaling; GET/POST API contracts and sequence diagrams; frontend/mobile/backend stack and API calling; direct/balancing/proxy metrics and SLIs; SLO/SLA/alerts/postmortems; functional/non-functional testing; API security/PII/privacy/fraud; complexity and PRDs; and a music-streaming capstone. This implementation translates those learning objectives into original cases rather than reproducing course copy.

## Architecture
Browser ES modules and semantic HTML/CSS → same-origin JSON API → server-only scenario engine → SQLite. No runtime packages, external AI, or API credentials required. Node 24 provides HTTP, crypto and SQLite. Static files are explicitly allowlisted. Scenario variants, answer keys and unrevealed evidence are never sent before debrief. Seeded templates produce reproducible variants; this is authored procedural generation, not unbounded generative AI.

An opaque, HttpOnly, SameSite session cookie identifies one learner. Only the hashed token is stored. Progress survives restarts on the persistent volume. It is a personal practice MVP, without account login, cross-device sync, or high-stakes exam identity verification. Losing the cookie loses access to that learner's progress; export completed attempts for a portable record. One Render instance and persistent disk; migrate the repository layer to Postgres before horizontal scaling.

## Implementation plan
1. Author ten curriculum tracks with two hidden constraint profiles each and actionable evidence.
2. Build server-side creation, budgeted discovery, artifacts, decisions, branching updates, rubric and replay.
3. Build the lab workspace, curriculum browser, practice history, tools, and review/export flows.
4. Verify hidden-state boundaries, session isolation, persistence, budget, progression, scoring and invalid inputs.
5. Provide a local preview, Git commit, and Render Blueprint; deploy when authenticated services are available.

## Scoring
100 points = 25 investigation + 35 decision fit + 20 adaptation + 20 artifact completeness. Investigation measures selection of the decisive source, triangulation and rationale referencing collected evidence IDs. Decision fit uses authored scenario-dependent answer keys. Adaptation uses the quality of the response to a decision-dependent event. Artifact completeness measures filled sections only, clearly labeled as such. Free-text quality is reviewed with explicit self-assessment criteria; no claim of semantic AI grading. A submitted decision cannot be revised, and its draft is snapshotted. Capstone feedback is withheld until all five stages finish. Average stage scores produce capstone total.

## Tool integrations
Built-in sandbox tools expose scenario-specific analytics, support interviews, service traces and API documentation as evidence; GET/POST request runner simulates a payments provider including timeout, validation and idempotency behavior. No requests reach a real payment provider. Markdown/JSON exports support external document workflows. Live Jira/Slack/GitHub integrations are intentionally not represented as connected.

## Privacy and operational limits
No third-party tracking; avoid entering real sensitive data. JSON payload size and field length limits, session-scoped queries, CSRF origin enforcement, rate limits, restrictive CSP, same-origin static serving, and transactional state updates protect the MVP. Sessions expire after 180 days. No public leaderboard. Back up the SQLite database using SQLite backup tooling; copying a live WAL database alone is unsafe. Render disk snapshots can support recovery. Add account recovery, migrations, audit retention policy and operational monitoring before a multi-user commercial release.
