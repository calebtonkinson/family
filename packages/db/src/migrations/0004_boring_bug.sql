ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "attachments_json" jsonb DEFAULT '[]'::jsonb NOT NULL;
