CREATE TYPE "public"."research_effort" AS ENUM('quick', 'standard', 'deep');--> statement-breakpoint
CREATE TYPE "public"."research_finding_status" AS ENUM('partial', 'sufficient', 'conflicted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."research_run_status" AS ENUM('planning', 'running', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "research_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_run_id" uuid NOT NULL,
	"sub_question" text NOT NULL,
	"claim" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"supporting_source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "research_finding_status" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_run_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"report_markdown" text NOT NULL,
	"actions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"status" "research_run_status" DEFAULT 'planning' NOT NULL,
	"query" text NOT NULL,
	"effort" "research_effort" DEFAULT 'standard' NOT NULL,
	"recency_days" integer,
	"plan_json" jsonb NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_run_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"domain" text,
	"snippet" text,
	"published_at" timestamp,
	"retrieved_at" timestamp DEFAULT now() NOT NULL,
	"score" numeric(5, 4),
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_runs" ADD CONSTRAINT "research_runs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "research_runs_conversation_created_idx" ON "research_runs" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "research_sources_run_idx" ON "research_sources" USING btree ("research_run_id");--> statement-breakpoint
CREATE INDEX "research_findings_run_idx" ON "research_findings" USING btree ("research_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_reports_run_unique" ON "research_reports" USING btree ("research_run_id");
