export interface DeepResearchPresentationInput {
  query: string;
  objective: string;
  executiveSummary: string;
  analystNarrative: string | null;
  findings: Array<{
    subQuestion: string;
    claim: string;
    confidence: number;
    status: string;
    sources: Array<{ id: string; title: string | null; url: string; domain: string | null }>;
    notes: string | null;
  }>;
  unknowns: string[];
  actions: Array<{ title: string; description?: string }>;
  sources: Array<{ id: string; title: string | null; url: string; domain: string | null }>;
  qualityWarnings: string[];
}

export function buildDeepResearchPresentationPrompt(
  input: DeepResearchPresentationInput,
): string {
  return `You are formatting research results for a user. Given their original question and the research findings below, write a clear, helpful response.

User question: ${input.query}
Research objective: ${input.objective}

Executive summary:
${input.executiveSummary}

${input.analystNarrative ? `Analyst narrative:\n${input.analystNarrative}\n` : ""}
Per-question findings:
${JSON.stringify(input.findings, null, 2)}

${input.unknowns.length > 0 ? `Unknowns / evidence gaps:\n${input.unknowns.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n` : ""}
${input.actions.length > 0 ? `Suggested actions:\n${input.actions.map((a, i) => `${i + 1}. ${a.title}${a.description ? ` - ${a.description}` : ""}`).join("\n")}\n` : ""}
${input.qualityWarnings.length > 0 ? `Quality warnings (reflect these honestly):\n${input.qualityWarnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}\n` : ""}
Available sources:
${input.sources.map((s) => `- [${s.id}] ${s.title || s.domain || s.url} (${s.url})`).join("\n")}

---

Write your response in the "markdown" field. This is the main output the user will see — it should read like a helpful, well-written answer to their question. Use inline citations like [source title](url) where appropriate. Structure it naturally with headings, paragraphs, and lists as needed.

You also have OPTIONAL display tools available via the "blocks" array. You do NOT need to use any blocks — a plain markdown response is perfectly fine for most questions. Only use blocks when they genuinely improve clarity:

- "comparison_table": When comparing 2+ options side by side (columns = option names, rows = attributes)
- "ranked_list": When recommending a shortlist of specific items with titles, subtitles, details, and optional URLs
- "sources": A collapsible list of source citations (label + url). Use this instead of listing sources inline when there are 4+ sources.
- "callout": An info/warning/tip box for important caveats, limitations, or pro tips
- "action_items": A checklist of next steps for the user

Rules:
- Write naturally. This should feel like a knowledgeable friend answering the question.
- Do NOT start with "Based on my research..." or similar preambles. Just answer.
- Be honest about uncertainty and evidence quality. If evidence was thin, say so.
- Do not invent details not present in the findings/sources.
- Do not repeat the same information in both the markdown and a block. Blocks supplement the markdown.
- Most queries need 0-2 blocks at most. Many need zero.
- If you include a sources block, you can reference sources by name in the markdown without full URLs.
- Include actionable next steps when evidence is incomplete.`;
}
