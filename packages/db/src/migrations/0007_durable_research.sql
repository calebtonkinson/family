ALTER TYPE "public"."research_run_status" ADD VALUE IF NOT EXISTS 'completed_with_warnings';--> statement-breakpoint
ALTER TABLE "research_runs" ADD COLUMN "quality_score" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "research_findings" ADD COLUMN "evidence_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "research_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"sub_question" text,
	"message" text,
	"payload_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_run_events" ADD CONSTRAINT "research_run_events_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_run_events_run_idx" ON "research_run_events" USING btree ("research_run_id","created_at");--> statement-breakpoint
DELETE FROM "research_sources" a
USING "research_sources" b
WHERE a."research_run_id" = b."research_run_id"
  AND a."url" = b."url"
  AND a.ctid > b.ctid;--> statement-breakpoint
CREATE UNIQUE INDEX "research_sources_run_url_unique" ON "research_sources" USING btree ("research_run_id","url");
