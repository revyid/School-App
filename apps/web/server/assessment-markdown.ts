const PENDING_ASSESS_IMAGE = /!\[([^\]\r\n]*)\]\(\/api\/assessment-images\/(q-[a-f0-9]{16}\.(?:jpg|png))\)/g;
const ANY_PENDING_ASSESS_IMAGE = /!\[[^\]\r\n]*\]\(\/api\/assessment-images\/[^)]*\)/g;

export function pendingAssessmentImageNames(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(new RegExp(PENDING_ASSESS_IMAGE.source, "g"))].map((match) => match[2]))];
}

export function hasInvalidPendingAssessmentImage(markdown: string): boolean {
  const references = [...markdown.matchAll(new RegExp(ANY_PENDING_ASSESS_IMAGE.source, "g"))];
  return references.some((reference) => !new RegExp(`^!\\[[^\\]\\r\\n]*\\]\\(\\/api\\/assessment-images\\/q-[a-f0-9]{16}\\.(?:jpg|png)\\)$`).test(reference[0]));
}

export function finalizeAssessmentImageUrls(markdown: string, questionId: string): string {
  const id = encodeURIComponent(questionId);
  return markdown.replace(
    new RegExp(PENDING_ASSESS_IMAGE.source, "g"),
    (_match, alt: string, name: string) => `![${alt}](/api/assess-files/${id}/${name})`,
  );
}

export function stemReferencesAssessmentImage(stem: string, questionId: string, name: string): boolean {
  const url = `/api/assess-files/${encodeURIComponent(questionId)}/${encodeURIComponent(name)}`;
  return stem.includes(`](${url})`);
}
