const PENDING_MESSAGE_KEY = "pendingChatMessage";
const PENDING_FILES_KEY = "pendingChatFiles";
const PENDING_RESEARCH_KEY = "pendingChatResearch";

export type PendingChatFile = {
  type: "file";
  url: string;
  mediaType: string;
  filename?: string;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export function setPendingMessage(message: string) {
  sessionStorage.setItem(PENDING_MESSAGE_KEY, message);
}

export async function setPendingFiles(files: FileList | File[]) {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return;

  const serialized: PendingChatFile[] = await Promise.all(
    fileArray.map(async (file) => ({
      type: "file",
      url: await readFileAsDataUrl(file),
      mediaType: file.type || "application/octet-stream",
      filename: file.name,
    })),
  );

  sessionStorage.setItem(PENDING_FILES_KEY, JSON.stringify(serialized));
}

export function getPendingMessage(): string | null {
  const message = sessionStorage.getItem(PENDING_MESSAGE_KEY);
  if (message) {
    sessionStorage.removeItem(PENDING_MESSAGE_KEY);
  }
  return message;
}

export function getPendingFiles(): PendingChatFile[] | null {
  const raw = sessionStorage.getItem(PENDING_FILES_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_FILES_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingChatFile[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setPendingResearch(value: boolean) {
  if (value) {
    sessionStorage.setItem(PENDING_RESEARCH_KEY, "1");
  } else {
    sessionStorage.removeItem(PENDING_RESEARCH_KEY);
  }
}

export function getPendingResearch(): boolean {
  const value = sessionStorage.getItem(PENDING_RESEARCH_KEY);
  if (value) {
    sessionStorage.removeItem(PENDING_RESEARCH_KEY);
  }
  return value === "1";
}
