# Future Improvements

## Design Principle (shared)

Layered architecture with clear boundaries:

- Frontend: presentational components -> hooks/state -> service adapters.
- Backend: API controllers -> services -> infrastructure (Firestore/Ollama clients).

## Roadmap to Full Service

### Foundations

- Authentication: Firebase Auth for users + admin RBAC, JWT validation, session refresh.
- Multi-tenant data model: chat ownership, tenant-level settings, billing metadata.
- Secrets + config: environment-based config, per-tenant model allowlists, secure key rotation.

### Product Experience

- Chat UX: streaming chat, markdown rendering, message timestamps, model picker with discovery.
- Admin UX: per-key actions in list, copy-to-clipboard, inline status badges, quick filters.
- User settings: saved prompts, conversation search, export/import chat history.

### Reliability + Ops

- Observability: structured logs, latency budgets, tracing, admin action audit logs.
- Quotas: per-tenant rate limits, daily caps, usage alerts, backpressure handling.
- Storage lifecycle: retention policies, soft deletes, archival jobs.

### Platform + Scale

- Billing: metering by token usage, Stripe integration, prepaid credits.
- Deployment: CI/CD, staging environments, smoke tests, rollback automation.
- Compliance: audit trails, data residency support, GDPR export/delete workflows.

### Testing

- UI tests for error/empty/loading states, chat streaming, permissions.
- API contract tests, Firestore integration tests, rate-limit edge cases.
