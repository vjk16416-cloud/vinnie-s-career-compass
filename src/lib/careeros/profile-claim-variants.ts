import { PROFILE_CLAIM_VARIANTS as AUDIT_PROFILE_CLAIM_VARIANTS } from "./profile-extraction";
import { POST_AUDIT_CLAIM_VARIANTS } from "./profile-post-audit";

export const PROFILE_CLAIM_VARIANTS = [
  ...AUDIT_PROFILE_CLAIM_VARIANTS,
  ...POST_AUDIT_CLAIM_VARIANTS,
];
