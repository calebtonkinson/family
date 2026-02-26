export interface DeepResearchExecutionPromptInput {
  objective: string;
  subQuestion: string;
  evidenceBlocks: Array<{
    sourceId: string;
    title: string | null;
    url: string;
    snippet: string | null;
    extractedText: string | null;
  }>;
}

export const DEEP_RESEARCH_EXECUTION_JSON_CONTRACT = {
  findings: [
    {
      claim: "string",
      confidence: "number between 0 and 1",
      sourceIds: ["source-id"],
      status: "partial | sufficient | conflicted | unknown",
      notes: "string",
    },
  ],
  unknowns: ["string"],
  actions: [
    {
      title: "string",
      description: "string",
      relatedFindingSourceIds: ["source-id"],
    },
  ],
};

export function buildDeepResearchExecutionPrompt(
  input: DeepResearchExecutionPromptInput,
): string {
  return `You are synthesizing evidence for one sub-question in a deep research run.

Objective: ${input.objective}
Sub-question: ${input.subQuestion}

Evidence (JSON):
${JSON.stringify(input.evidenceBlocks, null, 2)}

Return strict JSON only with this shape:
${JSON.stringify(DEEP_RESEARCH_EXECUTION_JSON_CONTRACT, null, 2)}

Rules:
- Every finding must cite at least one sourceId
- confidence should reflect source quality + source agreement
- use status=unknown when evidence is weak or absent
- keep claims concise and directly answer the sub-question
- if evidence conflicts, mark status=conflicted and explain in notes
- include all fields shown in the contract for every object
- if no unknowns/actions exist, return empty arrays
- for action.description use an empty string when none
- for action.relatedFindingSourceIds use [] when none`;
}
