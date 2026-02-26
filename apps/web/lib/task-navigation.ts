const TASKS_PATH = "/tasks";
const NEW_TASK_PATH = "/tasks/new";

interface BuildNewTaskHrefOptions {
  projectId?: string | null;
  themeId?: string | null;
  returnTo?: string | null;
}

export function sanitizeTaskReturnTo(returnTo?: string | null): string {
  if (!returnTo) return TASKS_PATH;
  if (!returnTo.startsWith("/")) return TASKS_PATH;
  if (returnTo.startsWith("//")) return TASKS_PATH;
  if (returnTo.startsWith(NEW_TASK_PATH)) return TASKS_PATH;
  return returnTo;
}

export function getTaskReturnToFromLocation(pathname: string, queryString?: string): string {
  const returnTo = queryString ? `${pathname}?${queryString}` : pathname;
  return sanitizeTaskReturnTo(returnTo);
}

export function buildNewTaskHref({
  projectId,
  themeId,
  returnTo,
}: BuildNewTaskHrefOptions = {}): string {
  const params = new URLSearchParams();

  if (projectId) params.set("projectId", projectId);
  if (themeId) params.set("themeId", themeId);
  if (returnTo) params.set("returnTo", sanitizeTaskReturnTo(returnTo));

  const query = params.toString();
  return query ? `${NEW_TASK_PATH}?${query}` : NEW_TASK_PATH;
}

export function buildNewTaskHrefFromLocation(pathname: string, queryString?: string): string {
  if (pathname.startsWith(NEW_TASK_PATH)) return NEW_TASK_PATH;
  return buildNewTaskHref({ returnTo: getTaskReturnToFromLocation(pathname, queryString) });
}
