export interface JobExtract {
  ok: true;
  confidence: "high" | "medium";
  completeness: "complete" | "partial";
  method: "structured" | "semantic";
  wordCount: number;
  qualityNotes: string[];
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
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => safeChar(Number(decimal)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED[name.toLowerCase()] ?? match);
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
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

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

function cleanLines(text: string) {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[•\-*\u2022\s]+/, "").trim();
    if (line.length < 3 || NOISE_PATTERNS.some((pattern) => pattern.test(line))) continue;
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines;
}

interface SectionBuckets {
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  qualifications: string[];
  benefits: string[];
  about: string[];
  intro: string[];
}

const SECTION_RULES: Array<{ key: keyof SectionBuckets; re: RegExp }> = [
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
  {
    key: "about",
    re: /(about (us|the (company|organisation|team))|who we are|our story|company overview)/i,
  },
];

function looksLikeHeading(line: string) {
  if (line.length > 90 || /[.!?]$/.test(line)) return false;
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
      const rule = SECTION_RULES.find((candidate) => candidate.re.test(line));
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

function findTools(text: string) {
  const lower = text.toLowerCase();
  return TOOL_LIBRARY.filter((tool) => lower.includes(tool.toLowerCase()));
}

function findCompetencies(text: string) {
  const lower = text.toLowerCase();
  return COMPETENCY_LIBRARY.filter((item) => lower.includes(item)).map(
    (item) => item.charAt(0).toUpperCase() + item.slice(1),
  );
}

function findExperience(lines: string[]) {
  return lines
    .filter(
      (line) =>
        /\b\d+\+?\s*(\+)?\s*(years?|yrs)\b/i.test(line) || /experience (in|of|with)/i.test(line),
    )
    .slice(0, 8);
}

function detectWorkplaceType(text: string) {
  const lower = text.toLowerCase();
  if (/\bhybrid\b/.test(lower)) return "Hybrid";
  if (/\b(fully )?remote\b|work from home|telecommute/.test(lower)) return "Remote";
  if (/\bon[- ]?site\b|office[- ]based/.test(lower)) return "On-site";
  return "";
}

function detectEmploymentType(text: string) {
  const lower = text.toLowerCase();
  if (/fixed[- ]term/.test(lower)) return "Fixed-term";
  if (/\bcontract\b|\bcontractor\b|\binterim\b/.test(lower)) return "Contract";
  if (/part[- ]time/.test(lower)) return "Part-time";
  if (/\bpermanent\b|full[- ]time/.test(lower)) return "Permanent";
  if (/\binternship\b|\bgraduate scheme\b/.test(lower)) return "Internship";
  return "";
}

function detectSalary(text: string) {
  const match =
    text.match(
      /(£|\$|€)\s?\d[\d,.]*\s?(k)?\s?(-|–|to)\s?(£|\$|€)?\s?\d[\d,.]*\s?(k)?(\s?(per annum|pa|p\.a\.|a year))?/i,
    ) ?? text.match(/(£|\$|€)\s?\d[\d,.]*\s?(k)?(\s?(per annum|per hour|pa|a year|an hour))?/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}

function detectClosingDate(text: string) {
  const match = text.match(
    /(closing date|applications? close[sd]?|deadline)[^\n]{0,40}?((\d{1,2}\s+\w+\s+\d{4})|(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\w+\s+\d{1,2},?\s+\d{4}))/i,
  );
  return match?.[2]?.trim() ?? "";
}

function flatten(node: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => flatten(item, out));
  } else if (node && typeof node === "object") {
    const object = node as Record<string, unknown>;
    out.push(object);
    if (object["@graph"]) flatten(object["@graph"], out);
  }
  return out;
}

function typeMatches(object: Record<string, unknown>) {
  const raw = object["@type"];
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((value) => typeof value === "string" && value.toLowerCase() === "jobposting");
}

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return textOf(
      object["name"] ?? object["addressLocality"] ?? object["address"] ?? object["value"] ?? "",
    );
  }
  return "";
}

function locationOf(object: Record<string, unknown>) {
  const raw = object["jobLocation"];
  const locations = Array.isArray(raw) ? raw : [raw];
  const parts: string[] = [];
  for (const location of locations) {
    if (location && typeof location === "object") {
      const address = (location as Record<string, unknown>)["address"];
      if (address && typeof address === "object") {
        const record = address as Record<string, unknown>;
        const segments = [record["addressLocality"], record["addressRegion"], record["addressCountry"]]
          .map(textOf)
          .filter(Boolean);
        if (segments.length) parts.push(segments.join(", "));
        continue;
      }
    }
    const value = textOf(location);
    if (value) parts.push(value);
  }
  if (!parts.length) {
    const remote = textOf(object["applicantLocationRequirements"]);
    if (remote) parts.push(`Remote – ${remote}`);
    if (object["jobLocationType"] === "TELECOMMUTE" && !remote) parts.push("Remote");
  }
  return [...new Set(parts)].join(" / ").slice(0, 120);
}

function salaryOf(object: Record<string, unknown>) {
  const salary = object["baseSalary"];
  if (!salary || typeof salary !== "object") return "";
  const record = salary as Record<string, unknown>;
  const currency = textOf(record["currency"]);
  const value = record["value"];
  if (!value || typeof value !== "object") return textOf(value);
  const range = value as Record<string, unknown>;
  const min = textOf(range["minValue"]);
  const max = textOf(range["maxValue"]);
  const single = textOf(range["value"]);
  const unit = textOf(range["unitText"]).toLowerCase();
  const amount = min && max ? `${min} – ${max}` : single || min || max;
  return amount ? `${currency ? `${currency} ` : ""}${amount}${unit ? ` per ${unit}` : ""}`.trim() : "";
}

function prettyEmployment(value: string) {
  const map: Record<string, string> = {
    FULL_TIME: "Permanent (full-time)",
    PART_TIME: "Part-time",
    CONTRACTOR: "Contract",
    TEMPORARY: "Fixed-term",
    INTERN: "Internship",
    OTHER: "",
  };
  return value
    .split(/,\s*/)
    .map((item) => map[item.trim().toUpperCase()] ?? item.trim())
    .filter(Boolean)
    .join(", ");
}

interface AssembleBase {
  method: "structured" | "semantic";
  title: string;
  company: string;
  location: string;
  employmentType: string;
  salary: string;
  closingDate: string;
  applyUrl: string;
  sourceUrl: string;
}

function assemble(base: AssembleBase, descriptionText: string): JobExtract | null {
  const lines = cleanLines(descriptionText);
  const body = lines.join("\n");
  const words = countWords(body);
  if (words < 60) return null;

  const buckets = sectionise(lines);
  const responsibilities = buckets.responsibilities.slice(0, 14);
  const requiredSkills = buckets.requiredSkills.slice(0, 14);
  const preferredSkills = buckets.preferredSkills.slice(0, 10);
  const qualifications = buckets.qualifications.slice(0, 8);
  const summarySource = buckets.intro.length ? buckets.intro : lines;
  const summary = summarySource
    .filter((line) => line.split(/\s+/).length > 8)
    .slice(0, 3)
    .join(" ")
    .slice(0, 600);

  const enoughSections = responsibilities.length >= 2 && requiredSkills.length >= 2;
  const enoughText = words >= 120;
  const identityPresent = Boolean(base.title.trim() && base.company.trim());
  const completeness: JobExtract["completeness"] =
    enoughText && enoughSections && (base.method === "semantic" || identityPresent)
      ? "complete"
      : "partial";
  const qualityNotes: string[] = [];
  if (!enoughText) qualityNotes.push(`Only ${words} meaningful words were captured.`);
  if (responsibilities.length < 2) qualityNotes.push("Few clearly labelled responsibilities were found.");
  if (requiredSkills.length < 2) qualityNotes.push("Few clearly labelled requirements were found.");
  if (!identityPresent && base.method === "structured") {
    qualityNotes.push("The structured data did not include both role title and company.");
  }

  return {
    ok: true,
    confidence: completeness === "complete" ? "high" : "medium",
    completeness,
    method: base.method,
    wordCount: words,
    qualityNotes,
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
    text: body.slice(0, 20000),
  };
}

function fromJsonLd(html: string, sourceUrl: string): JobExtract | null {
  const blocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const block of blocks) {
    const raw = decodeEntities(block[1] ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const object of flatten(parsed)) {
      if (!typeMatches(object)) continue;
      const description = typeof object["description"] === "string" ? object["description"] : "";
      const text = htmlToText(description);
      const built = assemble(
        {
          method: "structured",
          title: decodeEntities(textOf(object["title"])).trim(),
          company: decodeEntities(textOf(object["hiringOrganization"])).trim(),
          location: decodeEntities(locationOf(object)).trim(),
          employmentType: prettyEmployment(textOf(object["employmentType"])),
          salary: salaryOf(object),
          closingDate: textOf(object["validThrough"]).slice(0, 10),
          applyUrl: textOf(object["url"]) || sourceUrl,
          sourceUrl,
        },
        text,
      );
      if (built) return built;
    }
  }
  return null;
}

function metaContent(html: string, key: string) {
  const first = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const second = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const match = html.match(first) ?? html.match(second);
  return match?.[1] ? decodeEntities(match[1]).trim() : "";
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
    const match = cleaned.match(pattern);
    const text = match?.[1] ? htmlToText(match[1]) : "";
    if (countWords(text) > countWords(best)) best = text;
    if (countWords(best) >= 180) break;
  }
  if (countWords(best) < 120) return null;

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
  const structured = fromJsonLd(html, sourceUrl);
  if (structured) return structured;
  const semantic = fromSemantic(html, sourceUrl);
  if (semantic) return semantic;
  return {
    ok: false,
    reason:
      "The page did not return a readable job description. It may be rendered by scripts, behind a sign-in, or too incomplete to analyse safely. Paste the full job description manually instead.",
  };
}
