export interface ExtractSuccess {
  ok: true;
  title: string;
  company: string;
  location: string;
  text: string;
}
export interface ExtractFailure {
  ok: false;
  reason: string;
}
export type ExtractResult = ExtractSuccess | ExtractFailure;

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  pound: "£",
  euro: "€",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m);
}

function safeChar(code: number) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return " ";
  }
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(t: string) {
  return t.split(/\s+/).filter(Boolean).length;
}

function flatten(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    node.forEach((n) => flatten(n, out));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    out.push(obj);
    if (obj["@graph"]) flatten(obj["@graph"], out);
  }
  return out;
}

function typeMatches(obj: Record<string, unknown>): boolean {
  const t = obj["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.toLowerCase() === "jobposting");
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(", ");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textOf(o["name"] ?? o["addressLocality"] ?? o["address"] ?? o["value"] ?? "");
  }
  return "";
}

function locationOf(obj: Record<string, unknown>): string {
  const jl = obj["jobLocation"];
  const nodes = Array.isArray(jl) ? jl : [jl];
  const parts: string[] = [];
  for (const n of nodes) {
    if (n && typeof n === "object") {
      const addr = (n as Record<string, unknown>)["address"];
      if (addr && typeof addr === "object") {
        const a = addr as Record<string, unknown>;
        const seg = [a["addressLocality"], a["addressRegion"], a["addressCountry"]]
          .map(textOf)
          .filter(Boolean);
        if (seg.length) parts.push(seg.join(", "));
        continue;
      }
    }
    const t = textOf(n);
    if (t) parts.push(t);
  }
  if (!parts.length) {
    const remote = textOf(obj["applicantLocationRequirements"]);
    if (remote) parts.push(`Remote — ${remote}`);
    if (obj["jobLocationType"] === "TELECOMMUTE" && !remote) parts.push("Remote");
  }
  return [...new Set(parts)].join(" / ").slice(0, 120);
}

function fromJsonLd(html: string): ExtractSuccess | null {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  for (const block of blocks) {
    const rawJson = decodeEntities(block[1] ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      continue;
    }
    for (const obj of flatten(parsed)) {
      if (!typeMatches(obj)) continue;
      const description = typeof obj["description"] === "string" ? obj["description"] : "";
      const text = htmlToText(description);
      if (wordCount(text) < 60) continue;
      return {
        ok: true,
        title: decodeEntities(textOf(obj["title"])).trim().slice(0, 140),
        company: decodeEntities(textOf(obj["hiringOrganization"])).trim().slice(0, 120),
        location: decodeEntities(locationOf(obj)).trim(),
        text: text.slice(0, 20000),
      };
    }
  }
  return null;
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re) ?? html.match(alt);
  return m?.[1] ? decodeEntities(m[1]).trim() : "";
}

const CONTAINER_PATTERNS = [
  /<div[^>]+(?:id|class)=["'][^"']*(?:job-?description|jobDescription|job-?details|jobsearch-JobComponent-description|description__text|posting|vacancy)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  /<section[^>]+(?:id|class)=["'][^"']*(?:job|description|vacancy)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
  /<article[^>]*>([\s\S]*?)<\/article>/i,
  /<main[^>]*>([\s\S]*?)<\/main>/i,
];

function fromHtmlFallback(html: string): ExtractSuccess | null {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  let best = "";
  for (const pattern of CONTAINER_PATTERNS) {
    const m = cleaned.match(pattern);
    const text = m?.[1] ? htmlToText(m[1]) : "";
    if (wordCount(text) > wordCount(best)) best = text;
    if (wordCount(best) >= 150) break;
  }
  if (wordCount(best) < 80) return null;

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title =
    metaContent(html, "og:title") || decodeEntities(titleTag).replace(/\s+/g, " ").trim();
  return {
    ok: true,
    title: title.slice(0, 140),
    company: metaContent(html, "og:site_name").slice(0, 120),
    location: "",
    text: best.slice(0, 20000),
  };
}

export function extractJobPosting(html: string): ExtractResult {
  const jsonLd = fromJsonLd(html);
  if (jsonLd) return jsonLd;
  const fallback = fromHtmlFallback(html);
  if (fallback) return fallback;
  return {
    ok: false,
    reason:
      "The page did not return a readable job description — it is likely rendered by scripts or behind a sign-in.",
  };
}
