import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/integrations/supabase/types";

const EXPECTED_EMAIL = "vjk16416@gmail.com";
const SNAPSHOT_DATE = "2026-08-16";

const DRIVE = {
  masterProfile: "https://docs.google.com/document/d/154AAI-KiLDpoZPDRmzX6UUn9n6niXHyeg1r09lWqs7c/edit",
  evidenceBank: "https://docs.google.com/document/d/1RQC10S4I3LulysK6mkyTQmtc8EZ4BK8ENjVyKByelo4/edit",
  metricsRegister: "https://docs.google.com/document/d/1-nTmLGW90RB6SU-Vwn16-pXz7-I8Gc9ACNrmXpIV9Vc/edit",
  educationRegister: "https://docs.google.com/document/d/1Is4d-4q-lESLIMF1_C0avEBdmuVeOuhIofDU8SEM0Lw/edit",
  starBank: "https://docs.google.com/document/d/164cKHi_68FAgWKt3b00uyAwfN3tw-LFCECtmQoMrbtQ/edit",
  cvIndex: "https://docs.google.com/document/d/1plzPRS7F0LGCWTvaxdUsSQ-B7HPcaOdfu_npfn4PqwY/edit",
} as const;

const MASTER_CVS = [
  {
    id: "1ZnzOJLfcwCYlTlG3ekpi3fr4f2PSK8k5",
    sourceTitle: "MASTER - Product - BlackRock Product Management CV",
    roleFamily: "Product / Product Management",
    url: "https://docs.google.com/document/d/1ZnzOJLfcwCYlTlG3ekpi3fr4f2PSK8k5/edit",
    sourceUpdatedAt: "2026-08-10T01:21:37.882Z",
  },
  {
    id: "1hU-SE6kV-ysl-4lefvzUMmg7bcacTR3Q",
    sourceTitle: "MASTER - Product - Teya Junior Product Manager",
    roleFamily: "Product / Junior Product Manager",
    url: "https://docs.google.com/document/d/1hU-SE6kV-ysl-4lefvzUMmg7bcacTR3Q/edit",
    sourceUpdatedAt: "2026-08-10T01:21:21.438Z",
  },
  {
    id: "1aFC9hCV-MUor0--zyUI5qsg9OaJYdEdE",
    sourceTitle: "MASTER - Project Delivery - Reply Graduate Project Manager",
    roleFamily: "Project / PMO / Delivery",
    url: "https://docs.google.com/document/d/1aFC9hCV-MUor0--zyUI5qsg9OaJYdEdE/edit",
    sourceUpdatedAt: "2026-08-10T01:21:53.237Z",
  },
] as const;

type KnowledgeStatus = Database["public"]["Enums"]["knowledge_status"];
type EmploymentInsert = Database["public"]["Tables"]["employment_roles"]["Insert"];
type KnowledgeInsert = Database["public"]["Tables"]["knowledge_items"]["Insert"];
type EvidenceInsert = Database["public"]["Tables"]["evidence_items"]["Insert"];
type ResumeInsert = Database["public"]["Tables"]["resume_versions"]["Insert"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

function stableUuid(kind: string, sourceId: string) {
  const chars = createHash("sha256")
    .update(`careeros:vinnie:${kind}:${sourceId}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const ROLE_DEFINITIONS = [
  {
    sourceId: "northeastern-2025",
    employer: "Northeastern University London",
    title: "Performance Marketing Manager",
    employment_type: "Contract",
    start_date: "2025-06-01",
    end_date: "2025-11-01",
    is_current: false,
  },
  {
    sourceId: "idea-statica-2023-2024",
    employer: "IDEA StatiCa UK",
    title: "Marketing & Operations Executive",
    employment_type: "Contract",
    start_date: "2023-09-01",
    end_date: "2024-06-01",
    is_current: false,
  },
  {
    sourceId: "buchanan-2023",
    employer: "Buchanan Staffing Group",
    title: "Senior Digital Marketing Executive",
    employment_type: "Contract",
    start_date: "2023-02-01",
    end_date: "2023-05-01",
    is_current: false,
  },
  {
    sourceId: "nas-2022-2023",
    employer: "National Autistic Society",
    title: "Digital Advertising Officer",
    employment_type: null,
    start_date: "2022-04-01",
    end_date: "2023-02-01",
    is_current: false,
  },
  {
    sourceId: "infinite-2016-2022",
    employer: "Infinite Entertainment UK",
    title: "Senior Digital Marketing Executive",
    employment_type: null,
    start_date: "2016-06-01",
    end_date: "2022-04-01",
    is_current: false,
  },
] as const;

const ROLE_FACTS = [
  ["nul-paid-acquisition", "northeastern-2025", "Paid acquisition ownership", "Owned paid acquisition across PPC, paid social, display and multiple third-party platforms.", "responsibility"],
  ["nul-multimarket", "northeastern-2025", "Multi-market analysis", "Ran multi-market analysis across the UK, India and UAE.", "responsibility"],
  ["nul-vendors", "northeastern-2025", "Agency and vendor coordination", "Coordinated agency and vendor delivery across digital acquisition activity.", "responsibility"],
  ["nul-testing", "northeastern-2025", "Landing-page and A/B testing", "Worked on landing-page and A/B testing activity to support campaign optimisation.", "achievement"],
  ["nul-chatbot", "northeastern-2025", "AI chatbot QA rollout", "Owned QA testing for a new AI-powered chatbot rollout, defining test criteria and running structured testing cycles before go-live.", "project"],
  ["idea-adoption", "idea-statica-2023-2024", "Enterprise software adoption", "Supported enterprise software adoption and client engagement activity with structural-engineering clients.", "responsibility"],
  ["idea-cross-functional", "idea-statica-2023-2024", "Cross-functional delivery", "Worked across sales, support and marketing contexts to coordinate delivery and client activity.", "responsibility"],
  ["idea-powerbi", "idea-statica-2023-2024", "Power BI reporting layer", "Built a Power BI reporting layer using HubSpot and Salesforce data to improve stakeholder visibility.", "achievement"],
  ["idea-workflow", "idea-statica-2023-2024", "Asana and Agile-style workflow improvements", "Introduced Asana-based workflows and Agile-style delivery practices to improve ownership, sequencing and visibility.", "achievement"],
  ["buchanan-crm", "buchanan-2023", "Salesforce to Zoho CRM migration", "Owned and coordinated a CRM migration/integration project involving Salesforce and Zoho.", "project"],
  ["buchanan-funnel", "buchanan-2023", "Marketing collateral and funnel work", "Delivered marketing collateral and funnel activity in a recruitment context.", "responsibility"],
  ["buchanan-agencies", "buchanan-2023", "Agency and recruitment-manager coordination", "Coordinated agencies and recruitment managers across marketing delivery.", "responsibility"],
  ["nas-paid-search", "nas-2022-2023", "Paid-search agency workstream", "Coordinated paid-search and keyword work with an external agency.", "responsibility"],
  ["nas-awareness", "nas-2022-2023", "Autism Awareness Month campaign coordination", "Coordinated cross-functional campaign delivery and stakeholder reporting for Autism Awareness Month fundraising activity.", "project"],
  ["nas-budget-resources", "nas-2022-2023", "Campaign budgets, resources and deadlines", "Managed campaign budgets, resources and deadlines. No canonical budget amount is verified for this role.", "responsibility"],
  ["infinite-strategy", "infinite-2016-2022", "Digital and influencer strategy", "Led digital and influencer strategy across social channels for live events.", "responsibility"],
  ["infinite-ticketing", "infinite-2016-2022", "Event-ticket sales activity", "Supported event-ticket sales activity through digital marketing and campaign delivery.", "responsibility"],
  ["infinite-clickup", "infinite-2016-2022", "ClickUp campaign management", "Used ClickUp to manage campaign activity and delivery for live events.", "responsibility"],
] as const;

const STAR_FACTS = [
  {
    key: "star-nul-channel-spend",
    role: "northeastern-2025",
    title: "Diagnosing inefficient channel spend",
    context: "Paid acquisition spanned multiple platforms and markets with substantial performance variation.",
    action: "Owned paid-acquisition analysis and reporting, using channel comparison and RAG-style analysis to inform optimisation and reallocation decisions.",
    result: "Supported evidence-led prioritisation and reallocation decisions. Exact uplift and efficiency percentages remain unverified.",
  },
  {
    key: "star-idea-reporting",
    role: "idea-statica-2023-2024",
    title: "Creating a clearer reporting layer",
    context: "Marketing, sales and support information sat across HubSpot and Salesforce, creating fragmented reporting.",
    action: "Built a Power BI analytics and reporting layer using HubSpot and Salesforce data.",
    result: "Improved reporting visibility. Quantified conversion and ROI uplift requires primary-source verification.",
  },
  {
    key: "star-idea-workflow",
    role: "idea-statica-2023-2024",
    title: "Improving delivery workflow",
    context: "Multiple initiatives and stakeholders needed clearer ownership and delivery visibility.",
    action: "Introduced Asana-based workflows and Agile-style delivery practices across marketing and operations.",
    result: "Qualitative process improvement is supported. Exact completion or delay-reduction percentages remain unverified.",
  },
  {
    key: "star-buchanan-crm",
    role: "buchanan-2023",
    title: "CRM migration and integration",
    context: "Salesforce and Zoho communication tracking required more consolidated handling.",
    action: "Owned and coordinated a CRM migration/integration project with relevant stakeholders.",
    result: "Stronger consolidated communication and tracking is supported. Quantified engagement and cost outcomes remain unverified.",
  },
] as const;

const PROJECT_FACTS = [
  ["project-intentionally", "Intentionally founder-led MVP", "Founder-led personal venture in active mobile-first MVP development. Supported work includes product vision, problem framing, MVP scope, staged go-to-market planning, success metrics, roadmap, safety principles, prototype direction, waitlist testing, risk mitigation and QA planning. Pre-commercial: do not claim paying users, revenue, scaled production or senior engineering leadership."],
  ["project-unidrop", "UniDrop UCL new-product-development concept", "Academic campus-logistics concept using Double Diamond/design thinking, stakeholder identification, Value Proposition Canvas, Business Model Canvas, SWOT/PESTLE, TAM/SAM/SOM and staged development gates. It is not a commercial product or implemented autonomous-delivery system."],
  ["project-bioprinting", "3D Bioprinting emerging-technology assessment", "UCL group assessment applying Technology Readiness Levels and Gartner Hype Cycle thinking to technology maturity and commercial readiness. This is technology-assessment evidence, not biomedical-engineering employment."],
  ["project-atlas", "Atlas founder-operations concept", "Internal founder-operations concept with a working static prototype and implementation-planning direction. It is not an operational or commercial product and has no supported user, revenue or production-deployment claims."],
] as const;

const QUALIFICATION_FACTS: ReadonlyArray<{
  key: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  sourceType: string;
}> = [
  { key: "edu-ucl-msc", title: "MSc Technology Management, University College London", content: "Part-time MSc Technology Management at UCL, in progress. Start and expected completion dates are not locked and must not be invented.", status: "user_confirmed", sourceType: "education_register" },
  { key: "edu-essex-bsc", title: "BSc Marketing and Management (2:1), University of Essex", content: "Completed BSc Marketing and Management with 2:1 classification. Completion year 2020 is strongly supported; month is not locked.", status: "user_confirmed", sourceType: "education_register" },
  { key: "cert-apm-pfq", title: "APM Project Fundamentals Qualification (PFQ)", content: "Verified and completed. Issued 13 January 2025 by the Association for Project Management, based on user-provided Credly evidence.", status: "verified", sourceType: "certificate" },
  { key: "training-google-analytics", title: "Google Analytics 3 & 4", content: "Listed as completed training in current CVs. Certificate is not present in the narrowed evidence set, so provider and date must not be embellished.", status: "imported_cv", sourceType: "current_cvs" },
  { key: "training-hotjar", title: "Hotjar Levels 1 & 2", content: "Listed as completed training in current CVs. Certificate is not present in the narrowed evidence set.", status: "imported_cv", sourceType: "current_cvs" },
  { key: "training-powerbi", title: "Introduction to Power BI", content: "Listed as completed training in current CVs. Certificate is not present in the narrowed evidence set.", status: "imported_cv", sourceType: "current_cvs" },
  { key: "cert-google-pm", title: "Google Project Management Professional Certificate", content: "Conflicting evidence. Do not present the full certificate as completed until a certificate or provider record is checked.", status: "needs_verification", sourceType: "education_register" },
  { key: "cert-prince2-foundation", title: "PRINCE2 Foundation", content: "Unresolved completion status. Do not present as completed until certificate evidence is checked.", status: "needs_verification", sourceType: "education_register" },
  { key: "cert-prince2-practitioner", title: "PRINCE2 Practitioner", content: "Older evidence supports in progress or pursuing, not completed.", status: "needs_verification", sourceType: "education_register" },
  { key: "cert-apm-pmq", title: "APM Project Management Qualification (PMQ)", content: "Reading or in progress in older resumes. Not a completed credential unless new evidence is supplied.", status: "needs_verification", sourceType: "education_register" },
  { key: "cert-pspo", title: "PSPO I / Scrum product qualification", content: "Not verified in the eligible evidence set. Do not present as achieved without certificate evidence.", status: "needs_verification", sourceType: "education_register" },
];

const METRIC_FACTS: ReadonlyArray<{
  key: string;
  title: string;
  employer: string;
  status: KnowledgeStatus;
  note: string;
}> = [
  { key: "metric-nul-budget", title: "£140k+ annual digital media budget", employer: "Northeastern University London", status: "needs_verification", note: "Usable with caution only after finance or platform verification." },
  { key: "metric-nul-leads", title: "40%+ uplift in qualified leads", employer: "Northeastern University London", status: "needs_verification", note: "Verify dashboard, period and attribution." },
  { key: "metric-nul-cpl", title: "CPL variation £3 to £646", employer: "Northeastern University London", status: "needs_verification", note: "Verify the source report." },
  { key: "metric-nul-efficiency", title: "35% efficiency improvement", employer: "Northeastern University London", status: "needs_verification", note: "Verify calculation and definition." },
  { key: "metric-nul-roi", title: "28% ROI improvement / 20% conversion uplift", employer: "Northeastern University London", status: "needs_verification", note: "Verify dashboard, period and denominator." },
  { key: "metric-nul-effectiveness", title: "23% campaign effectiveness uplift / 25% YoY CPA reduction", employer: "Northeastern University London", status: "excluded", note: "Soften until campaign effectiveness is defined and source checked." },
  { key: "metric-nul-pages", title: "30+ campaign landing pages", employer: "Northeastern University London", status: "needs_verification", note: "Page inventory should confirm scope." },
  { key: "metric-nul-ab", title: "27% conversion increase from landing-page/A-B activity", employer: "Northeastern University London", status: "needs_verification", note: "Verify test design and attribution." },
  { key: "metric-idea-efficiency", title: "20% client operational-efficiency improvement", employer: "IDEA StatiCa UK", status: "excluded", note: "Soften unless the calculation can be evidenced." },
  { key: "metric-idea-roi", title: "15% conversion uplift / 36% ROI improvement", employer: "IDEA StatiCa UK", status: "needs_verification", note: "Verify Power BI or CRM source, period and attribution." },
  { key: "metric-idea-completion", title: "25% project-completion improvement", employer: "IDEA StatiCa UK", status: "excluded", note: "Remove exact percentage until verified because older versions conflict." },
  { key: "metric-idea-prospecting", title: "32% response-rate improvement / 15% conversion uplift from prospecting", employer: "IDEA StatiCa UK", status: "needs_verification", note: "Verify CRM source." },
  { key: "metric-idea-traffic", title: "20% organic traffic growth", employer: "IDEA StatiCa UK", status: "excluded", note: "Remove or soften because causal wording differs across drafts." },
  { key: "metric-buchanan-crm", title: "62% engagement increase / 23% marketing-cost reduction", employer: "Buchanan Staffing Group", status: "needs_verification", note: "Verify CRM and cost records." },
  { key: "metric-buchanan-timefill", title: "20% or 25% time-to-fill reduction", employer: "Buchanan Staffing Group", status: "excluded", note: "Remove exact percentage because versions conflict." },
  { key: "metric-buchanan-collateral", title: "30% collateral/case-study engagement uplift", employer: "Buchanan Staffing Group", status: "needs_verification", note: "Verify analytics source." },
  { key: "metric-nas-paid-search", title: "30% click increase / 60% impression increase", employer: "National Autistic Society", status: "needs_verification", note: "Verify agency or platform report." },
  { key: "metric-nas-roas", title: "440% ROAS on 100K Running Challenge", employer: "National Autistic Society", status: "needs_verification", note: "Verify campaign report." },
  { key: "metric-nas-donors", title: "23% or 42% donor-base increase", employer: "National Autistic Society", status: "excluded", note: "Remove exact percentage until a primary source resolves the conflict." },
  { key: "metric-nas-reach", title: "500,000+ campaign reach", employer: "National Autistic Society", status: "excluded", note: "Soften or remove unless a campaign report is found." },
  { key: "metric-infinite-tickets", title: "800+ ticket sales per event", employer: "Infinite Entertainment UK", status: "needs_verification", note: "Verify whether this was typical, average or peak." },
  { key: "metric-infinite-uplift", title: "20%, 30% or 50% ticket-sales uplift", employer: "Infinite Entertainment UK", status: "excluded", note: "Remove exact percentage because versions conflict." },
  { key: "metric-infinite-total", title: "20,000 tickets / 10,000+ attendees across six seasons", employer: "Infinite Entertainment UK", status: "excluded", note: "Soften until ticketing totals are checked." },
  { key: "metric-infinite-waste", title: "18% less ad waste from predictive analytics", employer: "Infinite Entertainment UK", status: "excluded", note: "Remove unless primary analysis is found." },
];

function makeKnowledge(
  userId: string,
  key: string,
  fields: Omit<KnowledgeInsert, "id" | "user_id">,
): KnowledgeInsert & { id: string; user_id: string } {
  return {
    id: stableUuid("knowledge", key),
    user_id: userId,
    ...fields,
  };
}

export function buildVinnieMigrationRows(userId: string) {
  const roleIds = new Map(
    ROLE_DEFINITIONS.map((role) => [role.sourceId, stableUuid("employment", role.sourceId)]),
  );
  const roleIdsByEmployer = new Map(
    ROLE_DEFINITIONS.map((role) => [role.employer, roleIds.get(role.sourceId)!]),
  );

  const employmentRoles: Array<EmploymentInsert & { id: string; user_id: string }> =
    ROLE_DEFINITIONS.map((role) => ({
      id: roleIds.get(role.sourceId)!,
      user_id: userId,
      employer: role.employer,
      title: role.title,
      employment_type: role.employment_type,
      start_date: role.start_date,
      end_date: role.end_date,
      is_current: role.is_current,
      summary: `Canonical month-precision chronology from Google Drive, snapshot ${SNAPSHOT_DATE}.`,
    }));

  const knowledgeItems: Array<KnowledgeInsert & { id: string; user_id: string }> = [];

  for (const [key, role, title, content, category] of ROLE_FACTS) {
    knowledgeItems.push(
      makeKnowledge(userId, key, {
        employment_role_id: roleIds.get(role) ?? null,
        category,
        title,
        content,
        status: "user_confirmed",
        source_type: "evidence_bank",
        source_reference: DRIVE.evidenceBank,
      }),
    );
  }

  for (const fact of STAR_FACTS) {
    knowledgeItems.push(
      makeKnowledge(userId, fact.key, {
        employment_role_id: roleIds.get(fact.role) ?? null,
        category: "star_story",
        title: fact.title,
        content: `${fact.context} ${fact.action} ${fact.result}`,
        star_context: fact.context,
        star_action: fact.action,
        star_result: fact.result,
        status: "user_confirmed",
        source_type: "star_evidence_bank",
        source_reference: DRIVE.starBank,
      }),
    );
  }

  for (const [key, title, content] of PROJECT_FACTS) {
    knowledgeItems.push(
      makeKnowledge(userId, key, {
        employment_role_id: null,
        category: "project",
        title,
        content,
        status: "user_confirmed",
        source_type: "evidence_bank",
        source_reference: DRIVE.evidenceBank,
      }),
    );
  }

  for (const fact of QUALIFICATION_FACTS) {
    knowledgeItems.push(
      makeKnowledge(userId, fact.key, {
        employment_role_id: null,
        category: fact.key.startsWith("edu-") ? "education" : "qualification",
        title: fact.title,
        content: fact.content,
        status: fact.status,
        source_type: fact.sourceType,
        source_reference: DRIVE.educationRegister,
      }),
    );
  }

  for (const fact of METRIC_FACTS) {
    knowledgeItems.push(
      makeKnowledge(userId, fact.key, {
        employment_role_id: roleIdsByEmployer.get(fact.employer) ?? null,
        category: "metric",
        title: fact.title,
        content: fact.note,
        status: fact.status,
        source_type: "metrics_register",
        source_reference: DRIVE.metricsRegister,
      }),
    );
  }

  knowledgeItems.push(
    makeKnowledge(userId, "boundary-line-management", {
      employment_role_id: null,
      category: "boundary",
      title: "No verified formal line-management responsibility",
      content:
        "Reviewed evidence does not establish formal line-management responsibility. Project leadership, stakeholder coordination and agency management must not be presented as formal people management.",
      status: "verified",
      source_type: "evidence_bank",
      source_reference: DRIVE.evidenceBank,
    }),
  );

  const evidenceItems: Array<EvidenceInsert & { id: string; user_id: string }> =
    knowledgeItems.map((item) => ({
      id: stableUuid("evidence", item.id),
      user_id: userId,
      knowledge_item_id: item.id,
      evidence_type:
        item.status === "verified"
          ? "verified_canonical_record"
          : "canonical_google_drive_record",
      source_reference: item.source_reference ?? null,
      notes: `Migrated from canonical Google Drive snapshot ${SNAPSHOT_DATE}. Status preserved as ${item.status}.`,
      verified_at:
        item.status === "verified" ? `${SNAPSHOT_DATE}T00:00:00.000Z` : null,
    }));

  const resumeVersions: Array<ResumeInsert & { id: string; user_id: string }> =
    MASTER_CVS.map((master, index) => ({
      id: stableUuid("resume", master.id),
      user_id: userId,
      application_id: null,
      version_number: index + 1,
      status: "reference",
      content: {
        sourceTitle: master.sourceTitle,
        roleFamily: master.roleFamily,
        driveFileId: master.id,
        driveUrl: master.url,
        sourceUpdatedAt: master.sourceUpdatedAt,
        note:
          "Canonical role-family master remains in Google Drive. This row is a reference pointer, not independent evidence for claims or metrics.",
      } as Json,
      evidence_map: {
        evidenceAuthority: [
          DRIVE.masterProfile,
          DRIVE.evidenceBank,
          DRIVE.metricsRegister,
          DRIVE.educationRegister,
        ],
        styleAuthority: DRIVE.cvIndex,
      } as Json,
    }));

  const profile: ProfileInsert & { user_id: string } = {
    user_id: userId,
    display_name: "Vinnie Jegathees",
    location: "London, UK",
    professional_summary:
      "Technology management professional with experience across digital marketing, software adoption, analytics, project delivery and early-stage product work, with an MSc Technology Management at UCL in progress.",
    target_roles: [
      "Product Manager",
      "Associate Product Manager",
      "Product Operations",
      "Project Manager",
      "PMO",
      "Programme / Delivery",
      "Technology Consulting",
      "Digital Transformation",
      "Product Marketing",
    ],
    target_industries: [],
    writing_preferences: {
      locale: "en-GB",
      britishEnglish: true,
      naturalTone: true,
      roleBulletTarget: "3-5",
      avoidInventedClaims: true,
      sourceOfTruth: "Google Drive Career OS",
      snapshotDate: SNAPSHOT_DATE,
    } as Json,
  };

  return {
    profile,
    employmentRoles,
    knowledgeItems,
    evidenceItems,
    applications: [] as Array<Database["public"]["Tables"]["applications"]["Insert"]>,
    resumeVersions,
  };
}

async function verifyCounts(
  client: ReturnType<typeof createClient<Database>>,
  userId: string,
) {
  const tables = [
    "profiles",
    "employment_roles",
    "knowledge_items",
    "evidence_items",
    "applications",
    "resume_versions",
  ] as const;
  const counts: Record<(typeof tables)[number], number> = {
    profiles: 0,
    employment_roles: 0,
    knowledge_items: 0,
    evidence_items: 0,
    applications: 0,
    resume_versions: 0,
  };

  for (const table of tables) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  return counts;
}

async function runMigration() {
  const dryRun = process.argv.includes("--dry-run");
  const userId = process.env.CAREEROS_USER_ID;
  const previewUserId = userId ?? "11111111-1111-4111-8111-111111111111";
  const rows = buildVinnieMigrationRows(previewUserId);

  const expectedCounts = {
    profiles: 1,
    employment_roles: rows.employmentRoles.length,
    knowledge_items: rows.knowledgeItems.length,
    evidence_items: rows.evidenceItems.length,
    applications: rows.applications.length,
    resume_versions: rows.resumeVersions.length,
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          email: EXPECTED_EMAIL,
          snapshotDate: SNAPSHOT_DATE,
          counts: expectedCounts,
        },
        null,
        2,
      ),
    );
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey || !userId) {
    throw new Error(
      "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CAREEROS_USER_ID. Never expose the service-role key to browser code.",
    );
  }

  const client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError) throw authError;
  if (authUser.user.email?.toLowerCase() !== EXPECTED_EMAIL) {
    throw new Error(`CAREEROS_USER_ID must belong to ${EXPECTED_EMAIL}.`);
  }

  const migrateOnce = async () => {
    const { error: profileError } = await client
      .from("profiles")
      .upsert(rows.profile, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: roleError } = await client
      .from("employment_roles")
      .upsert(rows.employmentRoles, { onConflict: "id" });
    if (roleError) throw roleError;

    const { error: knowledgeError } = await client
      .from("knowledge_items")
      .upsert(rows.knowledgeItems, { onConflict: "id" });
    if (knowledgeError) throw knowledgeError;

    const { error: evidenceError } = await client
      .from("evidence_items")
      .upsert(rows.evidenceItems, { onConflict: "id" });
    if (evidenceError) throw evidenceError;

    const { error: resumeError } = await client
      .from("resume_versions")
      .upsert(rows.resumeVersions, { onConflict: "id" });
    if (resumeError) throw resumeError;
  };

  await migrateOnce();
  await migrateOnce();

  const counts = await verifyCounts(client, userId);
  for (const [table, expected] of Object.entries(expectedCounts)) {
    if (counts[table as keyof typeof counts] !== expected) {
      throw new Error(
        `${table} failed idempotence verification. Expected ${expected}, got ${counts[table as keyof typeof counts]}.`,
      );
    }
  }

  console.log(JSON.stringify({ migrated: true, email: EXPECTED_EMAIL, counts }, null, 2));
}

if (process.argv[1]?.endsWith("migrate-vinnie-data.ts")) {
  runMigration().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
