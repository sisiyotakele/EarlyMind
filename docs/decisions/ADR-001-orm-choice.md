# ADR-001: ORM Choice — Raw pg + node-pg-migrate over Prisma

**Date:** 2026-07-02
**Status:** Accepted
**Context:** Phase 0 database setup

## Decision

Use the `pg` npm package (raw PostgreSQL client) with `node-pg-migrate` for schema migrations, rather than Prisma ORM.

## Rationale

1. **CON-RES-002 (budget):** Both are open-source and free; no cost difference.
2. **Migration control:** `node-pg-migrate` supports raw SQL migrations, which lets us use PostgreSQL-specific DDL exactly as designed (custom ENUMs, partial unique indexes like `sessions_one_active_per_child`, CHECK constraints with subqueries). Prisma's migration engine does not support all of these natively.
3. **SRS §7.1 schema complexity:** The schema uses `CITEXT`, composite CHECK constraints involving subqueries, custom PG enum types, and `JSONB` columns. These are more naturally expressed in raw SQL than Prisma's schema language.
4. **Explicit query control:** All business-rule queries (e.g., PIN lockout, session state machine, audit log writes) are easier to audit for correctness and security in raw SQL than via ORM-generated queries.
5. **Team familiarity:** Raw SQL is more universally readable during code review for compliance audits (CON-PRIV-004/005).

## Trade-offs

- **Type safety on query results:** Manually typed `queryOne<T>` helper used; Prisma would provide this automatically. Mitigated by shared-types entities.ts being the source of truth for field names.
- **No auto-generated CRUD:** All queries written by hand. Acceptable for this project size.

## Alternatives Considered

- **Prisma:** Rejected due to migration DDL limitations for our custom ENUMs and partial indexes.
- **Drizzle ORM:** Considered; raw pg chosen for maximum SQL transparency during compliance reviews.
- **TypeORM:** Not considered; known performance issues and heavy decorator-based API.
