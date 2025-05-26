-- Add expenses table to existing database
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  livreur_id   UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  expense_date DATE NOT NULL,
  carburant    DECIMAL(12,2) DEFAULT 0,
  reparations  DECIMAL(12,2) DEFAULT 0,
  police       DECIMAL(12,2) DEFAULT 0,
  autres       DECIMAL(12,2) DEFAULT 0,
  commentaire  TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(livreur_id, expense_date)
);

-- Add indexes for expenses table
CREATE INDEX IF NOT EXISTS idx_expenses_livreur_date ON expenses(livreur_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Add trigger for expenses table
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 