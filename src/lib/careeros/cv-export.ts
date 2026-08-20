function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeFileToken(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function safeVersionNumber(version: number): number {
  return Number.isFinite(version) && version > 0 ? Math.floor(version) : 1;
}

export function buildWordCompatibleCv(body: string, title: string): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br>");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  @page { margin: 1.8cm; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.2;
    color: #000;
    text-align: left;
    margin: 0;
  }
  .document-title {
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 12pt;
  }
</style>
</head>
<body>
<div class="document-title">${safeTitle}</div>
<div>${safeBody}</div>
</body>
</html>`;
}

export function cvExportFileName(role: string, company: string, version: number): string {
  const companyToken = safeFileToken(company) || "Company";
  const roleToken = safeFileToken(role) || "CV";
  return `Vinnie_Jegathees_${companyToken}_${roleToken}_v${safeVersionNumber(version)}.doc`;
}

export function coverLetterExportFileName(role: string, company: string, version: number): string {
  const companyToken = safeFileToken(company) || "Company";
  const roleToken = safeFileToken(role) || "Cover_Letter";
  return `Vinnie_Jegathees_${companyToken}_${roleToken}_Cover_Letter_v${safeVersionNumber(version)}.doc`;
}

export function downloadWordCompatibleCv(body: string, title: string, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([buildWordCompatibleCv(body, title)], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printCv(body: string, title: string): boolean {
  if (typeof window === "undefined") return false;

  const popup = window.open("", "_blank");
  if (!popup) return false;

  popup.document.open();
  popup.document.write(buildWordCompatibleCv(body, title));
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
