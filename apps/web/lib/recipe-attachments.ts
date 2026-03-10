import type { Recipe, RecipeAttachment } from "@/lib/api-client";

export const isImageAttachment = (attachment: RecipeAttachment) =>
  attachment.mediaType.startsWith("image/");

export const isRemoteHttpUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const isWebLinkAttachment = (attachment: RecipeAttachment) =>
  !isImageAttachment(attachment) &&
  isRemoteHttpUrl(attachment.url) &&
  (attachment.mediaType === "text/html" ||
    attachment.mediaType === "text/uri-list");

export const getRecipeImageAttachments = (
  recipe: Pick<Recipe, "attachmentsJson">,
) => recipe.attachmentsJson.filter(isImageAttachment);

export const getRecipePrimaryImage = (
  recipe: Pick<Recipe, "attachmentsJson">,
) => getRecipeImageAttachments(recipe)[0] ?? null;

export const getRecipeReferenceAttachments = (
  recipe: Pick<Recipe, "attachmentsJson">,
) =>
  recipe.attachmentsJson.filter((attachment) => !isImageAttachment(attachment));

export const getAttachmentLabel = (
  attachment: RecipeAttachment,
  fallback: string,
) => {
  if (attachment.filename?.trim()) {
    return attachment.filename.trim();
  }

  if (isWebLinkAttachment(attachment)) {
    try {
      return new URL(attachment.url).hostname.replace(/^www\./, "");
    } catch {
      return fallback;
    }
  }

  return fallback;
};

export const inferAttachmentLabelFromUrl = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url);
    const pathPart = parsed.pathname.split("/").filter(Boolean).at(-1);
    return pathPart || parsed.hostname.replace(/^www\./, "") || fallback;
  } catch {
    return fallback;
  }
};

export const inferImageMediaTypeFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
};
