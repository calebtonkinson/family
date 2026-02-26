export interface DeepResearchBudget {
  maxSteps: number;
  maxRuntimeSeconds: number;
  minSources: number;
  maxRequeriesPerSubQuestion: number;
}

export interface DeepResearchPlanPromptInput {
  query: string;
  effort: "quick" | "standard" | "deep";
  recencyDays: number | null;
  budget: DeepResearchBudget;
}

export const DEEP_RESEARCH_PLAN_JSON_CONTRACT = {
  objective: "string",
  subQuestions: ["string"],
  assumptions: ["string"],
  outputFormat: "string",
  effortRationale: "string",
  stopCriteria: {
    confidenceTarget: "number between 0 and 1",
    diminishingReturnsDelta: "number between 0 and 1",
    diminishingReturnsWindow: "integer >= 1",
  },
};

export function buildDeepResearchPlanPrompt(input: DeepResearchPlanPromptInput): string {
  const recency = input.recencyDays ? `${input.recencyDays} days` : "none";

  return `You are generating a pre-run deep research plan.

User query: ${input.query}
Effort preset: ${input.effort}
Recency preference: ${recency}
Budget:
- max steps: ${input.budget.maxSteps}
- max runtime seconds: ${input.budget.maxRuntimeSeconds}
- minimum sources: ${input.budget.minSources}
- max re-queries per sub-question: ${input.budget.maxRequeriesPerSubQuestion}

Return strict JSON only with this shape:
${JSON.stringify(DEEP_RESEARCH_PLAN_JSON_CONTRACT, null, 2)}

Rules:
- objective must be one sentence
- produce 3-8 subQuestions
- avoid duplicate/overlapping subQuestions
- assumptions should be explicit and testable
- outputFormat should describe the final sections: summary, findings, unknowns, actions, sources
- stopCriteria should be practical for the provided effort budget`;
}
