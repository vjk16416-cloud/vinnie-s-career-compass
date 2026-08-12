export interface JobExtract {
  ok: true;
  confidence: "high" | "medium";
  method: "structured" | "semantic";
  title: string;
  company: string;
  location: string;
  workplaceType: string;
  employmentType: string;
  salary: string;
  closingDate: string;
  summary: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  experience: string[];
  tools: string[];
  competencies: string[];
  sourceUrl: string;
  applyUrl: string;
  text: string;
}
export interface ExtractFailure {
  ok: false;
  reason: string;
}
export type ExtractResult = JobExtract | ExtractFailure;

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

/* ---------------- boilerplate cleaning ---------------- */

const NOISE_PATTERNS = [
  /cookie/i,
  /privacy (policy|notice)/i,
  /terms (and|&) conditions/i,
  /accept all/i,
  /manage preferences/i,
  /skip to (main )?content/i,
  /sign ?in|log ?in|create an account|register now/i,
  /follow us|share this (job|role|vacancy)/i,
  /^\s*(home|jobs|careers|search|menu|back to (search|results|jobs))\s*$/i,
  /similar jobs|related jobs|other (jobs|vacancies)|you may also/i,
  /job alert/i,
  /all rights reserved|©|copyright/i,
  /registered (charity|company) (no|number)/i,
  /^\s*(apply now|apply for this job|save job|email this job|print)\s*$/i,
  /we are an equal opportunit/i,
  /disability confident/i,
  /recruitment agencies/i,
  /javascript|enable cookies|browser/i,
];

function cleanLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^[•\-*\u2022\s]+/, "").trim();
    if (!line) continue;
    if (line.length < 3) continue;
    if (NOISE_PATTERNS.some((p) => p.test(line))) continue;
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/* ---------------- sectioning ---------------- */

const SECTION_RULES: { key: keyof SectionBuckets; re: RegExp }[] = [
  {
    key: "responsibilities",
    re: /(responsibilit|what you.?ll (do|be doing)|the role|key duties|duties|accountabilit|main tasks|day to day|day-to-day|purpose of the (role|job))/i,
  },
  {
    key: "requiredSkills",
    re: /(essential|required|requirements|what you.?ll need|about you|we.?re looking for|you will have|must have|person specification|skills? (and|&) experience|key skills)/i,
  },
  {
    key: "preferredSkills",
    re: /(desirable|preferred|nice to have|bonus|advantageous|would be a plus)/i,
  },
  {
    key: "qualifications",
    re: /(qualificat|education|degree|certificat|accredit)/i,
  },
  { key: "benefits", re: /(benefit|what we offer|package|perks|reward|salary and)/i },
  { key: "about", re: /(about (us|the (company|organisation|team))|who we are|our story|company overview)/i },
];

interface SectionBuckets {
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  benefits: string[];
  about: string[];
  intro: string[];
}

function looksLikeHeading(line: string): boolean {
  if (line.length > 90) return false;
  if (/[.!?]$/.test(line)) return false;
  return /:$/.test(line) || line.split(/\s+/).length <= 9;
}

function sectionise(lines: string[]): SectionBuckets {
  const buckets: SectionBuckets = {
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    qualifications: [],
    benefits: [],
    about: [],
    intro: [],
  };
  let current: keyof SectionBuckets = "intro";
  for (const line of lines) {
    if (looksLikeHeading(line)) {
      const rule = SECTION_RULES.find((r) => r.re.test(line));
      if (rule) {
        current = rule.key;
        continue;
      }
    }
    buckets[current].push(line);
  }
  return buckets;
}

const TOOL_LIBRARY = [
  "Power BI",
  "Salesforce",
  "HubSpot",
  "GA4",
  "Google Analytics",
  "DV360",
  "Google Ads",
  "Meta Ads",
  "Hotjar",
  "Asana",
  "Jira",
  "Confluence",
  "MS Project",
  "ClickUp",
  "Monday.com",
  "Trello",
  "Zoho",
  "SQL",
  "Tableau",
  "Looker",
  "Figma",
  "Amplitude",
  "Mixpanel",
  "Excel",
  "Python",
  "Miro",
  "Notion",
  "Sitecore",
  "WordPress",
  "Adobe",
  "SAP",
  "Dynamics",
];

const COMPETENCY_LIBRARY = [
  "communication",
  "stakeholder management",
  "collaboration",
  "problem solving",
  "attention to detail",
  "leadership",
  "influencing",
  "organisation",
  "adaptability",
  "commercial awareness",
  "customer focus",
  "analytical thinking",
  "time management",
  "negotiation",
  "presentation",
];

function findTools(text: string): string[] {
  const lower = text.toLowerCase();
  return TOOL_LIBRARY.filter((t) => lower.includes(t.toLowerCase()));
}

function findCompetencies(text: string): string[] {
  const lower = text.toLowerCase();
  return COMPETENCY_LIBRARY.filter((c) => lower.includes(c)).map(
    (c) => c.charAt(0).toUpperCase() + c.slice(1),
  );
}

function findExperience(lines: string[]): string[] {
  return lines
    .filter((l) => /\b\d+\+?\s*(\+)?\s*(years?|yrs)\b/i.test(l) || /experience (in|of|with)/i.test(l))
    .slice(0, 6);
}

function detectWorkplaceType(text: string): string {
  const lower = text.toLowerCase();
  if (/\bhybrid\b/.test(lower)) return "Hybrid";
  if (/\b(fully )?remote\b|work from home|telecommute/.test(lower)) return "Remote";
  if (/\bon[- ]?site\b|office[- ]based/.test(lower)) return "On-site";
  return "";
}

function detectEmploymentType(text: string): string {
  const lower = text.toLowerCase();
  if (/fixed[- ]term/.test(lower)) return "Fixed-term";
  if (/\bcontract\b|\bcontractor\b|\binterim\b/.test(lower)) return "Contract";
  if (/part[- ]time/.test(lower)) return "Part-time";
  if (/\bpermanent\b|full[- ]time/.test(lower)) return "Permanent";
  if (/\binternship\b|\bgraduate scheme\b/.test(lower)) return "Internship";
  return "";
}

function detectSalary(text: string): string {
  const m =
    text.match(
      /(£|\$|€)\s?\d[\d,.]*\s?(k)?\s?(-|–|to)\s?(£|\$|€)?\s?\d[\d,.]*\s?(k)?(\s?(per annum|pa|p\.a\.|a year))?/i,
    ) ?? text.match(/(£|\$|€)\s?\d[\d,.]*\s?(k)?(\s?(per annum|per hour|pa|a year|an hour))?/i);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

function detectClosingDate(text: string): string {
  const m = text.match(
    /(closing date|applications? close[sd]?|deadline)[^\n]{0,40}?((\d{1,2}\s+\w+\s+\d{4})|(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\w+\s+\d{1,2},?\s+\d{4}))/i,
  );
  return m?.[2] ? m[2].trim() : "";
}

/* ---------------- JSON-LD ---------------- */

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
  if (typeof v === "number") return String(v);
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

function salaryOf(obj: Record<string, unknown>): string {
  const bs = obj["baseSalary"];
  if (!bs || typeof bs !== "object") return "";
  const o = bs as Record<string, unknown>;
  const currency = textOf(o["currency"]) || "";
  const value = o["value"];
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const min = textOf(v["minValue"]);
    const max = textOf(v["maxValue"]);
    const single = textOf(v["value"]);
    const unit = textOf(v["unitText"]).toLowerCase();
    const range = min && max ? `${min} – ${max}` : single || min || max;
    if (!range) return "";
    return `${currency ? currency + " " : ""}${range}${unit ? ` per ${unit}` : ""}`.trim();
  }
  return textOf(value);
}

/* ---------------- assembly ---------------- */

function assemble(
  base: {
    method: "structured" | "semantic";
    title: string;
    company: string;
    location: string;
    employmentType: string;
    salary: string;
    closingDate: string;
    applyUrl: string;
    sourceUrl: string;
  },
  descriptionText: string,
): JobExtract | null {
  const lines = cleanLines(descriptionText);
  const body = lines.join("\n");
  if (wordCount(body) < 60) return null;

  const buckets = sectionise(lines);
  const summarySource = buckets.intro.length ? buckets.intro : lines;
  const summary = summarySource
    .filter((l) => l.split(/\s+/).length > 8)
    .slice(0, 3)
    .join(" ")
    .slice(0, 600);

  const responsibilities = buckets.responsibilities.slice(0, 14);
  const requiredSkills = buckets.requiredSkills.slice(0, 14);
  const preferredSkills = buckets.preferredSkills.slice(0, 10);
  const qualifications = buckets.qualifications.slice(0, 8);

  const core = [
    summary,
    ...responsibilities,
    ...requiredSkills,
    ...preferredSkills,
    ...qualifications,
  ].join("\n");

  // If sectioning found nothing useful, fall back to the cleaned body.
  const structured =
    responsibilities.length + requiredSkills.length + qualifications.length >= 3;
  const text = structured ? core : body;

  const confidence: JobExtract["confidence"] =
    base.method === "structured" && structured ? "high" : base.method === "structured" ? "high" : "medium";

  return {
    ok: true,
    confidence,
    method: base.method,
    title: base.title.slice(0, 140),
    company: base.company.slice(0, 120),
    location: base.location.slice(0, 120),
    workplaceType: detectWorkplaceType(`${base.location} ${body}`),
    employmentType: base.employmentType || detectEmploymentType(body),
    salary: base.salary || detectSalary(body),
    closingDate: base.closingDate || detectClosingDate(body),
    summary,
    responsibilities,
    requiredSkills,
    preferredSkills,
    qualifications,
    experience: findExperience(lines),
    tools: findTools(body),
    competencies: findCompetencies(body),
    sourceUrl: base.sourceUrl,
    applyUrl: base.applyUrl || base.sourceUrl,
    text: text.slice(0, 20000),
  };
}

function fromJsonLd(html: string, sourceUrl: string): JobExtract | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
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
      const built = assemble(
        {
          method: "structured",
          title: decodeEntities(textOf(obj["title"])).trim(),
          company: decodeEntities(textOf(obj["hiringOrganization"])).trim(),
          location: decodeEntities(locationOf(obj)).trim(),
          employmentType: prettyEmployment(textOf(obj["employmentType"])),
          salary: salaryOf(obj),
          closingDate: textOf(obj["validThrough"]).slice(0, 10),
          applyUrl: textOf(obj["url"]) || sourceUrl,
          sourceUrl,
        },
        text,
      );
      if (built) return built;
    }
  }
  return null;
}

function prettyEmployment(v: string): string {
  const map: Record<string, string> = {
    FULL_TIME: "Permanent (full-time)",
    PART_TIME: "Part-time",
    CONTRACTOR: "Contract",
    TEMPORARY: "Fixed-term",
    INTERN: "Internship",
    OTHER: "",
  };
  return v
    .split(/,\s*/)
    .map((x) => map[x.trim().toUpperCase()] ?? x.trim())
    .filter(Boolean)
    .join(", ");
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

function fromSemantic(html: string, sourceUrl: string): JobExtract | null {
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
  if (wordCount(best) < 120) return null;

  const h1 = htmlToText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").split("\n")[0] ?? "";
  const titleTag = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const rawTitle = h1 || metaContent(html, "og:title") || titleTag;
  const title = rawTitle.split(/\s+[|\-–—]\s+/)[0]?.trim() ?? rawTitle;
  const company =
    metaContent(html, "og:site_name") ||
    (titleTag.includes("|") ? (titleTag.split("|").pop() ?? "").trim() : "");

  return assemble(
    {
      method: "semantic",
      title,
      company,
      location: "",
      employmentType: "",
      salary: "",
      closingDate: "",
      applyUrl: sourceUrl,
      sourceUrl,
    },
    best,
  );
}

export function extractJobPosting(html: string, sourceUrl = ""): ExtractResult {
  const jsonLd = fromJsonLd(html, sourceUrl);
  if (jsonLd) return jsonLd;
  const semantic = fromSemantic(html, sourceUrl);
  if (semantic) return semantic;
  return {
    ok: false,
    reason:
      "The page did not return a readable job description — it is likely rendered by scripts or behind a sign-in.",
  };
}
