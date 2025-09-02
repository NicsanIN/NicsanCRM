-- Nicsan CRM — Policies table (idempotent, aligned with backend)

-- 1) Create policies table if missing (UUID PK, matches backend expectations)
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number VARCHAR(100) UNIQUE NOT NULL,
  vehicle_number VARCHAR(50) NOT NULL,
  insurer VARCHAR(100) NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  cc VARCHAR(20),
  manufacturing_year VARCHAR(4),
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  idv DECIMAL(12,2) NOT NULL,
  ncb DECIMAL(5,2) NOT NULL,
  discount DECIMAL(5,2) DEFAULT 0,
  net_od DECIMAL(12,2) NOT NULL,
  ref VARCHAR(100),
  total_od DECIMAL(12,2) NOT NULL,
  net_premium DECIMAL(12,2) NOT NULL,
  total_premium DECIMAL(12,2) NOT NULL,
  cashback_percentage DECIMAL(5,2) DEFAULT 0,
  cashback_amount DECIMAL(12,2) DEFAULT 0,
  customer_paid DECIMAL(12,2) NOT NULL,
  customer_cheque_no VARCHAR(100),
  our_cheque_no VARCHAR(100),
  executive VARCHAR(100) NOT NULL,
  caller_name VARCHAR(100) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  rollover VARCHAR(100),
  remark TEXT,
  source VARCHAR(20) NOT NULL CHECK (source IN ('PDF_UPLOAD', 'MANUAL_FORM', 'MANUAL_GRID', 'CSV_IMPORT')),
  confidence_score DECIMAL(3,2),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PARSING', 'NEEDS_REVIEW', 'SAVED', 'REJECTED')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Ensure updated_at trigger function exists (reuses global helper if present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Attach trigger to policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_policies_updated_at'
  ) THEN
    CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- 3) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_policies_policy_number ON policies(policy_number);
CREATE INDEX IF NOT EXISTS idx_policies_vehicle_number ON policies(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_policies_insurer ON policies(insurer);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at);
CREATE INDEX IF NOT EXISTS idx_policies_created_by ON policies(created_by);

-- 4) Optional FK to pdf_uploads if policies.upload_id exists and pdf_uploads.id is uuid
DO $$
DECLARE
  has_upload_id BOOLEAN;
  pdf_is_uuid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'policies' AND column_name = 'upload_id'
  ) INTO has_upload_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_uploads' AND column_name = 'id' AND data_type = 'uuid'
  ) INTO pdf_is_uuid;

  IF has_upload_id AND pdf_is_uuid THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'policies' AND constraint_type = 'FOREIGN KEY' AND constraint_name = 'policies_upload_fk'
    ) THEN
      ALTER TABLE policies
      ADD CONSTRAINT policies_upload_fk
      FOREIGN KEY (upload_id) REFERENCES pdf_uploads(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;


