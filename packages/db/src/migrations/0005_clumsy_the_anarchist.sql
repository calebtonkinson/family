ALTER TABLE "meal_plans" ADD COLUMN IF NOT EXISTS "recipe_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD COLUMN IF NOT EXISTS "external_links_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meal_plans_household_date_slot_unique" ON "meal_plans" USING btree ("household_id","plan_date","meal_slot");
