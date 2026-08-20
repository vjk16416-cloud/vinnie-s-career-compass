export type ReviewInputIdentity = {
  applicationId: string;
  jobId: string;
  jobDescriptionSignature: string;
  scanId: string;
  scanJobDescriptionSignature: string;
  cvId: string;
  cvVersionId: string;
  coverLetterId: string;
};

export function textSignature(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function reviewInputSignature(input: ReviewInputIdentity): string {
  return textSignature(
    [
      input.applicationId,
      input.jobId,
      input.jobDescriptionSignature,
      input.scanId,
      input.scanJobDescriptionSignature,
      input.cvId,
      input.cvVersionId,
      input.coverLetterId,
    ].join("\u001f"),
  );
}
