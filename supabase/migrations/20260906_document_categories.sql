-- ============================================================
-- Migration: Dynamic Fleet Document Categories
-- Allows adding, modifying, toggling, and conditionally deleting
-- fleet document types exactly like the Flutter version.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_fr TEXT,
    applicable_to TEXT NOT NULL DEFAULT 'both' CHECK (applicable_to IN ('both', 'truck', 'trailer')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist idempotently
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS name_fr TEXT;
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS applicable_to TEXT NOT NULL DEFAULT 'both';
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_doc_categories_active ON public.document_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_doc_categories_applicable ON public.document_categories(applicable_to);

-- Enable RLS
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone authenticated can read document_categories') THEN
    CREATE POLICY "Anyone authenticated can read document_categories"
      ON public.document_categories FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins and secretaries can manage document_categories') THEN
    CREATE POLICY "Admins and secretaries can manage document_categories"
      ON public.document_categories FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

-- Seed Standard Document Categories if not present
INSERT INTO public.document_categories (name, name_fr, applicable_to, is_active)
VALUES
  ('التأمين الدولي / المحلي', 'Assurance', 'both', true),
  ('الفحص التقني', 'Visite Technique', 'both', true),
  ('البطاقة الرمادية', 'Carte Grise', 'both', true),
  ('رخصة النقل / CMR', 'Autorisation de Transport', 'truck', true),
  ('شهادة التبريد ATP', 'Certificat ATP', 'both', true),
  ('معايرة التاكوغراف', 'Tachygraphe', 'truck', true),
  ('وثيقة أخرى', 'Autre Document', 'both', true)
ON CONFLICT (name) DO UPDATE 
SET 
  name_fr = EXCLUDED.name_fr,
  applicable_to = EXCLUDED.applicable_to;

