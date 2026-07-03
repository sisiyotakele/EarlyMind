-- Migration 001: Enable required PostgreSQL extensions
-- Traceability: Phase 0 — DB foundation
-- CON-PRIV-002: encryption infrastructure; uuid generation

-- UUID generation (all primary keys use UUIDs per DR-001 through DR-009)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pg_trgm for phone number search performance
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
