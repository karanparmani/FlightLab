# Flightlab

A personal technical product-management practice simulator built from the ten available curriculum screenshots. Investigate incomplete evidence, write an artifact, commit a decision, respond to a consequence and review your reasoning.

## Run locally

Requires Node.js 24. No dependency installation or API key is required.

```sh
npm start
```

Open http://localhost:3000. Alternatively use `node server.js` if npm is not on your PATH. `npm run dev` restarts on server changes. The browser uses standard ES modules; no bundler is required.

```sh
npm run build
npm test
```

The build command verifies JavaScript syntax. Tests exercise all twenty authored constraint profiles, five-stage capstones, scoring, answer-key secrecy, evidence budgets, duplicate submissions, API/session isolation, restart persistence and sandbox idempotency.

## Practice flow

1. Choose a track. Each attempt receives a reproducible seed and a hidden constraint profile.
2. Spend five investigation credits on analytics, interviews, service traces or the planning brief. Evidence is tied to this attempt. In the capstone the evidence budget spans all five stages.
3. Write the structured working artifact. Cite collected evidence IDs in the rationale. Drafts save after a short pause; “Save & leave” explicitly waits for the save.
4. Commit a decision and confidence level. The server snapshots the artifact and locks the decision.
5. Respond to the resulting update. Single-track attempts reveal their debrief now; capstones continue through five stages before revealing grades.
6. Export Markdown/JSON, inspect the rubric and replay with a new or fixed seed.

## Included tracks

| Track | Deliverable |
|---|---|
| Service blueprint | Passenger/driver actions, frontstage, backstage, handoffs and ownership |
| Architecture | Components, storage ownership, dependencies, async flows and scaling tradeoffs |
| APIs | GET/POST contract, status codes, authorization, sequence and retry semantics |
| Tech stack | Frontend/mobile/backend choices, infrastructure, build/buy and API call example |
| Monitoring | Outcome tree, direct/proxy/balancing metrics and SLI definitions |
| Reliability | SLO, SLA distinction, error budget, incident response and blameless postmortem |
| Quality | Acceptance criteria, functional/non-functional tests, coverage and release gates |
| Security | API authorization, PII minimization/retention, threat model, fraud and appeals |
| Complexity/PRD | Problem, scope, architecture, estimates, milestones and discovery |
| Tech PM capstone | Music-streaming launch across five connected stages |

## Integrations and scoring

Analytics, interviews, traces and the payment API runner are **simulations**, not live integrations. Markdown and JSON exports work with external documentation workflows. The API runner simulates GET/POST, lost responses, idempotent replay, body/key conflicts and validation errors. No payment is created outside the simulator.

The authored rubric is 25 investigation + 35 decision fit + 20 adaptation + 20 artifact completeness. Investigation awards 12 for the decisive source, 8 for two sources and 5 for referencing a collected evidence ID. Correct decisions earn 35; an incorrect decision can recover 10 decision-fit points through the scenario's preferred adaptation. Adaptation earns 20 for the preferred response, 10 for another cautious response, or 0 for ignoring the risk. Artifact points are proportional to sections containing at least 60 characters at commitment. Capstone scores average the five stage scores. The self-review checklist evaluates depth separately; automated prose quality or certification is not claimed.

Twenty authored constraint profiles, with seed-based selection and decision-dependent updates, provide bounded replayability. Arbitrary new story generation, a diagram canvas, timed/proctored exams, live external account integrations and AI semantic grading are future extensions, not features represented as implemented.

## Deploy on Render

The repository contains `render.yaml`, based on the [Render Blueprint reference](https://render.com/docs/blueprint-spec). It declares a Node 24 service and a persistent disk for SQLite. A paid disk-compatible compute plan is required; confirm the price in Render before creating the service.

1. Push this directory as the root of a GitHub repository.
2. In Render, choose **New → Blueprint**, connect that repository, and select `render.yaml`.
3. Set `APP_ORIGIN` to the exact HTTPS service origin, without a trailing slash. Use the generated service URL shown by Render; update it if you later change domains. No other secrets are required.
4. Review the compute and disk charges, then create the service.
5. Verify `/health` returns `{"status":"ok"}`. Open the app, save an attempt, restart the service and verify it resumes.

`NODE_ENV=production` enables Secure cookies and HSTS. `DATA_DIR=/var/data/flightlab` stores SQLite on the persistent disk. Do not deploy to ephemeral storage if you want progress to survive redeploys. Run one instance; SQLite is not shared across multiple Render instances.

Source repository: [karanparmani/FlightLab](https://github.com/karanparmani/FlightLab). The Render configuration is ready; a live deployment has not yet been created.

## Configuration

Copy `.env.example` to `.env` if needed. Keep `.env` out of version control. `PORT` defaults to 3000, `DATA_DIR` to `./data`, and `APP_ORIGIN` to the current origin in development. No external fonts, analytics or third-party runtime requests are used.

Progress belongs to an anonymous, HttpOnly browser cookie and is stored server-side. There is no cross-device login or recovery. Clearing cookies loses access to the associated profile. Export important work. This MVP has no sensitive-data use case; do not enter real customer records. See [ARCHITECTURE.md](ARCHITECTURE.md) for the curriculum mapping, implementation plan, security controls and operational limits.
