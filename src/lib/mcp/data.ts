import { createSeedData } from "@/lib/careeros/seed";
import type { CareerOsData } from "@/lib/careeros/types";

/**
 * The MCP server reads the canonical seeded career record. Workspace edits live in
 * the browser's local store, so tools intentionally expose the verified baseline only.
 */
export function careerData(): CareerOsData {
  return createSeedData();
}
