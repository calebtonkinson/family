// Allowed email addresses for authentication
export const ALLOWED_EMAILS = [
  "calebtonkinson@gmail.com",
  "hillarytonkinson@gmail.com",
] as const;

// Task priority levels
export const PRIORITY_LEVELS = {
  NORMAL: 0,
  HIGH: 1,
  URGENT: 2,
} as const;

export const PRIORITY_LABELS: Record<number, string> = {
  [PRIORITY_LEVELS.NORMAL]: "Normal",
  [PRIORITY_LEVELS.HIGH]: "High",
  [PRIORITY_LEVELS.URGENT]: "Urgent",
};

// Task status labels
export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

// Recurrence type labels
export const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom_days: "Custom",
};

// Default AI settings
export const DEFAULT_AI_PROVIDER = "anthropic" as const;
export const DEFAULT_AI_MODEL = "claude-sonnet-4-20250514";
export const DEFAULT_AI_MAX_TOKENS = 4096;
export const DEFAULT_AI_TEMPERATURE = 0.7;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Date formats
export const DATE_FORMAT = "yyyy-MM-dd";
export const DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
export const DISPLAY_DATE_FORMAT = "MMM d, yyyy";
export const DISPLAY_TIME_FORMAT = "h:mm a";
