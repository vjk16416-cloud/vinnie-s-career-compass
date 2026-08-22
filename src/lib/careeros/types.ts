export type EvidenceStatus = "Verified" | "Needs Evidence" | "Archived" | "Excluded";

export type EvidenceCategory =
  | "Delivery"
  | "Performance Marketing"
  | "Analytics"
  | "Stakeholder Management"
  | "Product & Innovation"
  | "Technology"
  | "Commercial"
  | "Education";

export interface EvidenceRecord {
  id: string;
  employer: string;
  category: EvidenceCategory;
  claim: string;
  metricValue?: string | undefined;
  metricBasis?: string | undefined;
  source: string;
  notes?: string | undefined;
  confidence: "High" | "Medium" | "Low";
  status: EvidenceStatus;
  skills: string[];
  updatedAt: string;
}

export interface EmploymentRecord {
  id: string;
  title: string;
  company: string;
  employmentType: string;
  start: string;
  end: string;
  location: string;
  summary: string;
  highlights: string[];
  skills: string[];
}

export interface EducationRecord {
  id: string;
  qualification: string;
  institution: string;
  detail: string;
  period: string;
}

export interface CertificationRecord {
  id: string;
  name: string;
  issuer: string;
  completed: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  summary: string;
  skills: string[];
}

export interface CareerProfile {
  name: string;
  location: string;
  headline: string;
  summary: string;
  employment: EmploymentRecord[];
  education: EducationRecord[];
  certifications: CertificationRecord[];
  projects: ProjectRecord[];
  skills: string[];
  tools: string[];
  domains: string[];
}

export interface ProfileVersion {
  id: string;
  createdAt: string;
  label: string;
  note: string;
}

export type ProfileSourceType =
  | "CV"
  | "Resume"
  | "Cover Letter"
  | "Personal Statement"
  | "Evidence Audit"
  | "User Confirmation"
  | "Project Evidence"
  | "Evidence Register"
  | "Primary Evidence"
  | "Other";

export type ProfileSourceIngestionStatus = "Imported" | "Indexed" | "Excluded";
export type ProfileSourceTrust = "Canonical" | "Alternative" | "Historical" | "Unsafe" | "Evidence";
export type ProfileSourceExtractionStatus =
  "Reconciled" | "Raw extracted" | "Audit only" | "Missing raw file" | "Excluded";

export interface CareerProfileSource {
  id: string;
  auditId?: string | undefined;
  label: string;
  sourceType: ProfileSourceType;
  modifiedAt?: string | undefined;
  ownership: "Confirmed mine" | "Likely mine" | "User confirmed";
  ingestionStatus: ProfileSourceIngestionStatus;
  extractionStatus?: ProfileSourceExtractionStatus | undefined;
  trust: ProfileSourceTrust;
  externalFileId?: string | undefined;
  externalUrl?: string | undefined;
  notes?: string | undefined;
}

export type CareerProfileItemKind =
  | "Identity"
  | "Employment"
  | "Achievement"
  | "Skill"
  | "Tool"
  | "Project"
  | "Education"
  | "Certification"
  | "Domain";

export type CareerProfileItemStatus = "Approved" | "Needs Evidence" | "Conflict" | "Excluded";

export interface CareerProfileItem {
  id: string;
  kind: CareerProfileItemKind;
  label: string;
  value: string;
  safeWording?: string | undefined;
  sourceIds: string[];
  evidenceIds: string[];
  status: CareerProfileItemStatus;
  confidence: "High" | "Medium" | "Low";
  notes?: string | undefined;
  updatedAt: string;
}

export type CareerClaimVariantBasis =
  "Raw source" | "Evidence audit" | "CareerOS register" | "Primary evidence" | "User confirmation";

export interface CareerClaimVariant {
  id: string;
  canonicalKey: string;
  kind: CareerProfileItemKind;
  label: string;
  value: string;
  sourceIds: string[];
  basis: CareerClaimVariantBasis;
  status: CareerProfileItemStatus;
  confidence: "High" | "Medium" | "Low";
  notes?: string | undefined;
  updatedAt: string;
}

export type ProfileDecisionAction = "Approve" | "Needs Evidence" | "Exclude" | "Resolve Conflict";
export type ProfileDecisionTarget = "Profile Item" | "Claim Variant";

export interface CareerProfileDecision {
  id: string;
  at: string;
  action: ProfileDecisionAction;
  targetType: ProfileDecisionTarget;
  profileItemId?: string;
  canonicalKey?: string;
  selectedVariantId?: string;
  previousStatus?: CareerProfileItemStatus;
  newStatus: CareerProfileItemStatus;
  sourceIds: string[];
  note?: string;
}

export type ApplicationStage =
  | "Interested"
  | "Preparing"
  | "Applied"
  | "Screening"
  | "Interview"
  | "Assessment"
  | "Offer"
  | "Accepted"
  | "Rejected"
  | "Withdrawn"
  | "On Hold";

export const APPLICATION_STAGES: ApplicationStage[] = [
  "Interested",
  "Preparing",
  "Applied",
  "Screening",
  "Interview",
  "Assessment",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
  "On Hold",
];

export interface ApplicationHistoryEntry {
  at: string;
  entry: string;
}

export type JobExtractionCompleteness = "complete" | "partial" | "manual";
export type JobExtractionMethod = "structured" | "semantic" | "manual";

export type JobBoardSourceKind = "manual" | "imported" | "feed";

export interface JobBoardListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sourceKind: JobBoardSourceKind;
  sourceName?: string | undefined;
  sourceUrl?: string | undefined;
  applyUrl?: string | undefined;
  salary?: string | undefined;
  workplaceType?: string | undefined;
  employmentType?: string | undefined;
  closingDate?: string | undefined;
  postedAt?: string | undefined;
  importedAt: string;
  saved: boolean;
}

export interface JobBoardFilters {
  query: string;
  savedOnly: boolean;
  workplaceType?: string | undefined;
  employmentType?: string | undefined;
}

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  location: string;
  url?: string | undefined;
  description: string;
  createdAt: string;
  sourceType: "url" | "paste" | "board";
  extractionCompleteness?: JobExtractionCompleteness;
  extractionMethod?: JobExtractionMethod;
  descriptionWordCount?: number;
  boardListingId?: string | undefined;
}

export interface Application {
  id: string;
  jobId: string;
  company: string;
  title: string;
  location: string;
  workingArrangement: "On-site" | "Hybrid" | "Remote" | "Unspecified";
  employmentType: "Permanent" | "Contract" | "Fixed-term" | "Unspecified";
  priority: "High" | "Medium" | "Low";
  stage: ApplicationStage;
  dateAdded: string;
  deadline?: string | undefined;
  salary?: string | undefined;
  source?: string | undefined;
  contact?: string | undefined;
  url?: string | undefined;
  linkedCvId?: string | undefined;
  notes: string;
  nextAction?: string | undefined;
  nextActionDue?: string | undefined;
  compatibilityScore?: number | undefined;
  history: ApplicationHistoryEntry[];
}

export type CvCategory =
  | "Product Management"
  | "Product Marketing"
  | "Technology Consulting"
  | "Project Delivery"
  | "Programme Management"
  | "Innovation"
  | "Marketing Strategy"
  | "General";

export interface CvVersion {
  id: string;
  version: number;
  createdAt: string;
  note: string;
  body: string;
  evidenceIds: string[];
}

export interface CvDocument {
  id: string;
  name: string;
  category: CvCategory;
  status: "Draft" | "Approved" | "Archived";
  applicationId?: string | undefined;
  jobId?: string | undefined;
  approvedVersionId?: string | undefined;
  versions: CvVersion[];
  updatedAt: string;
}

export interface CoverLetter {
  id: string;
  applicationId?: string | undefined;
  jobId?: string | undefined;
  status: "Draft" | "Approved";
  body: string;
  emailVersion: string;
  evidenceIds: string[];
  createdAt: string;
}

export type ReviewOutcome = "NEEDS INPUT" | "NEEDS REVISION" | "READY FOR VINNIE APPROVAL";

export type ReviewCheckStatus = "Pass" | "Warning" | "Fail";
export type ReviewFindingSeverity = "Blocking" | "Advisory";
export type ReviewFindingResolution = "Input" | "Revision" | "Advisory";

export type ReviewCheckKey =
  | "jd-alignment"
  | "evidence"
  | "metrics"
  | "chronology"
  | "ats"
  | "star"
  | "british-english"
  | "ai-language-risk"
  | "cover-letter";

export interface ReviewFinding {
  id: string;
  check: ReviewCheckKey;
  severity: ReviewFindingSeverity;
  resolution: ReviewFindingResolution;
  message: string;
  evidenceId?: string | undefined;
  profileItemId?: string | undefined;
}

export interface ReviewCheckResult {
  key: ReviewCheckKey;
  label: string;
  status: ReviewCheckStatus;
  findings: ReviewFinding[];
}

export interface ApplicationReviewRun {
  id: string;
  applicationId: string;
  jobId: string;
  scanId: string;
  cvId: string;
  cvVersionId: string;
  coverLetterId: string;
  inputSignature: string;
  createdAt: string;
  outcome: ReviewOutcome;
  checks: ReviewCheckResult[];
  strengths: string[];
  highPriorityFixes: string[];
}

export type ApplicationGateState =
  | "NOT REVIEWED"
  | "REVIEW OUTDATED"
  | "NEEDS INPUT"
  | "NEEDS REVISION"
  | "READY FOR VINNIE APPROVAL"
  | "READY TO APPLY";

export interface ScanSubScore {
  key: string;
  label: string;
  score: number;
  reason: string;
}

export type RequirementCategory =
  "Responsibility" | "Skill" | "Experience" | "Qualification" | "Sector" | "Tool" | "Competency";
export type RequirementPriority = "Required" | "Preferred";
export type RequirementMatchStatus = "Covered" | "Partial" | "Gap" | "Blocked";

export interface EvidenceMapItem {
  id: string;
  requirement: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  status: RequirementMatchStatus;
  score: number;
  evidenceIds: string[];
  profileItemIds: string[];
  sourceIds: string[];
  explanation: string;
}

export type Verdict = "Strong Fit" | "Competitive" | "Plausible Stretch" | "Weak Fit";

export interface ScanResult {
  id: string;
  jobId: string;
  createdAt: string;
  jobDescriptionSignature?: string | undefined;
  overall: number;
  verdict: Verdict;
  subScores: ScanSubScore[];
  strengths: { text: string; evidenceId?: string | undefined }[];
  partials: string[];
  gaps: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  blockedEvidence: { id: string; claim: string; status: EvidenceStatus }[];
  evidenceMap?: EvidenceMapItem[];
  strategy: "Apply" | "Apply with tailored positioning" | "Consider" | "Skip";
  reasons: string[];
}

export interface ActivityEntry {
  id: string;
  at: string;
  text: string;
}

export interface Settings {
  claudeReviewEnabled: boolean;
  googleDriveFolder: string;
  driveConnected: boolean;
  dataSource: "Local seeded data";
}

export interface CareerOsData {
  profile: CareerProfile;
  profileVersions: ProfileVersion[];
  profileSources?: CareerProfileSource[];
  profileItems?: CareerProfileItem[];
  profileClaimVariants?: CareerClaimVariant[];
  profileDecisions?: CareerProfileDecision[];
  evidence: EvidenceRecord[];
  jobs: JobRecord[];
  jobBoardListings?: JobBoardListing[];
  applications: Application[];
  cvs: CvDocument[];
  coverLetters: CoverLetter[];
  scans: ScanResult[];
  reviewRuns?: ApplicationReviewRun[];
  activity: ActivityEntry[];
  settings: Settings;
}
