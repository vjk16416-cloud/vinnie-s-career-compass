import { auth, defineMcp } from "@lovable.dev/mcp-js";
import extractJobPostingTool from "./tools/extract-job-posting";
import getCareerProfileTool from "./tools/get-career-profile";
import listEvidenceTool from "./tools/list-evidence";
import scoreJobTool from "./tools/score-job";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "vinnie-s-career-compass",
  title: "Vinnie's Career Compass",
  version: "0.1.0",
  instructions:
    "CareerOS tools for a private career workspace. Use get_career_profile and list_evidence to read the verified career record, extract_job_posting to pull structured fields from a job advert URL, and score_job to run the Role Compatibility Score. Only evidence with status 'Verified' may be used in CVs or cover letters; never invent metrics or experience.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCareerProfileTool, listEvidenceTool, extractJobPostingTool, scoreJobTool],
});
