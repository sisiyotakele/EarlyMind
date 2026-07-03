-- Migration: 002_updated_at_trigger
-- Auto-update updated_at timestamps on every row modification.
-- Applied to all tables that have an updated_at column.
--
-- Traceability: SRS §7.1 (schema)

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER children_updated_at
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
