import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversation.js";
import { households } from "./household.js";
import { users } from "./user.js";

export const researchRunStatusEnum = pgEnum("research_run_status", [
  "planning",
  "running",
  "completed",
  "completed_with_warnings",
  "failed",
  "canceled",
]);

export const researchEffortEnum = pgEnum("research_effort", [
  "quick",
  "standard",
  "deep",
]);

export const researchFindingStatusEnum = pgEnum("research_finding_status", [
  "partial",
  "sufficient",
  "conflicted",
  "unknown",
]);

export type ResearchPlanJson = {
  objective: string;
  subQuestions: string[];
  assumptions: string[];
  outputFormat: string;
  effortRationale?: string;
  stopCriteria: {
    confidenceTarget: number;
    diminishingReturnsDelta: number;
    diminishingReturnsWindow: number;
  };
};

export type ResearchMetricsJson = {
  phase?: "planning" | "researching" | "synthesizing" | "complete" | "failed";
  stepCount?: number;
  sourceCount?: number;
  findingCount?: number;
  durationMs?: number;
  completedSubQuestions?: number;
  totalSubQuestions?: number;
  minSources?: number;
  maxSteps?: number;
  maxRuntimeSeconds?: number;
  maxRequeriesPerSubQuestion?: number;
  failureReason?: string;
  qualityScore?: number;
};

export type ResearchEvidenceJson = Array<{
  sourceId: string;
  excerpt: string | null;
  relevanceScore: number;
  url: string;
  title: string | null;
}>;

export type ResearchActionJson = {
  title: string;
  description?: string;
  relatedFindingIds?: string[];
  createdTaskId?: string;
};

export type ResearchPresentationBlockJson =
  | { type: "prose"; markdown: string }
  | {
      type: "comparison_table";
      caption?: string;
      columns: string[];
      rows: Array<{ label: string; values: string[] }>;
    }
  | {
      type: "ranked_list";
      title?: string;
      items: Array<{ title: string; subtitle?: string; detail?: string; url?: string }>;
    }
  | { type: "sources"; items: Array<{ label: string; url: string }> }
  | { type: "callout"; variant: "info" | "warning" | "tip"; content: string }
  | {
      type: "action_items";
      title?: string;
      items: Array<{ text: string; detail?: string }>;
    };

export type ResearchPresentationJson = {
  markdown: string;
  blocks: ResearchPresentationBlockJson[];
};

export const researchRuns = pgTable("research_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdById: uuid("created_by_id")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),
  status: researchRunStatusEnum("status").default("planning").notNull(),
  query: text("query").notNull(),
  effort: researchEffortEnum("effort").default("standard").notNull(),
  recencyDays: integer("recency_days"),
  planJson: jsonb("plan_json").$type<ResearchPlanJson>().notNull(),
  metricsJson: jsonb("metrics_json").$type<ResearchMetricsJson>().default({}).notNull(),
  qualityScore: numeric("quality_score", { precision: 5, scale: 4 }),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const researchSources = pgTable("research_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  researchRunId: uuid("research_run_id")
    .references(() => researchRuns.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  title: text("title"),
  domain: text("domain"),
  snippet: text("snippet"),
  publishedAt: timestamp("published_at"),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
  score: numeric("score", { precision: 5, scale: 4 }),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchFindings = pgTable("research_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  researchRunId: uuid("research_run_id")
    .references(() => researchRuns.id, { onDelete: "cascade" })
    .notNull(),
  subQuestion: text("sub_question").notNull(),
  claim: text("claim").notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  supportingSourceIds: jsonb("supporting_source_ids").$type<string[]>().default([]).notNull(),
  evidenceJson: jsonb("evidence_json").$type<ResearchEvidenceJson>().default([]).notNull(),
  status: researchFindingStatusEnum("status").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchRunEvents = pgTable("research_run_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  researchRunId: uuid("research_run_id")
    .references(() => researchRuns.id, { onDelete: "cascade" })
    .notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull(),
  subQuestion: text("sub_question"),
  message: text("message"),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchReports = pgTable("research_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  researchRunId: uuid("research_run_id")
    .references(() => researchRuns.id, { onDelete: "cascade" })
    .notNull(),
  summary: text("summary").notNull(),
  reportMarkdown: text("report_markdown").notNull(),
  actionsJson: jsonb("actions_json").$type<ResearchActionJson[]>().default([]).notNull(),
  presentationJson: jsonb("presentation_json").$type<ResearchPresentationJson>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ResearchRun = typeof researchRuns.$inferSelect;
export type NewResearchRun = typeof researchRuns.$inferInsert;
export type ResearchSource = typeof researchSources.$inferSelect;
export type NewResearchSource = typeof researchSources.$inferInsert;
export type ResearchFinding = typeof researchFindings.$inferSelect;
export type NewResearchFinding = typeof researchFindings.$inferInsert;
export type ResearchReport = typeof researchReports.$inferSelect;
export type NewResearchReport = typeof researchReports.$inferInsert;
export type ResearchRunEvent = typeof researchRunEvents.$inferSelect;
export type NewResearchRunEvent = typeof researchRunEvents.$inferInsert;
