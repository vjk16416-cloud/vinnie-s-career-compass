import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthorisedUser } from "../auth/auth.server";
import { dedupeDiscoveredJobs, type DiscoveredJob } from "./job-discovery";
import { fetchArbeitnowUkJobs, fetchRemotiveJobs } from "./job-providers";

export interface JobBoardDiscoveryResult {
  jobs: DiscoveredJob[];
  warnings: string[];
  fetchedAt: string;
}

type ProviderLoader = {
  label: string;
  load: () => Promise<DiscoveredJob[]>;
};

export async function combineJobProviders(
  providers: ProviderLoader[],
  fetchedAt = new Date().toISOString(),
): Promise<JobBoardDiscoveryResult> {
  const settled = await Promise.allSettled(providers.map((provider) => provider.load()));
  const jobs: DiscoveredJob[] = [];
  const warnings: string[] = [];

  settled.forEach((result, index) => {
    const provider = providers[index];
    if (!provider) return;
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      warnings.push(`${provider.label} is temporarily unavailable.`);
    }
  });

  if (jobs.length === 0 && warnings.length === providers.length) {
    throw new Error("Live job sources are temporarily unavailable. Try again shortly.");
  }

  return {
    jobs: dedupeDiscoveredJobs(jobs),
    warnings,
    fetchedAt,
  };
}

const DiscoveryInput = z
  .object({ includeVisaSponsorship: z.boolean().optional() })
  .default({ includeVisaSponsorship: true });

export const discoverJobs = createServerFn({ method: "POST" })
  .validator((data: unknown) => DiscoveryInput.parse(data ?? {}))
  .handler(async ({ data }) => {
    await requireAuthorisedUser();

    return combineJobProviders([
      {
        label: "Arbeitnow UK",
        load: () =>
          fetchArbeitnowUkJobs({ includeVisaSponsorship: data.includeVisaSponsorship ?? true }),
      },
      { label: "Remotive", load: () => fetchRemotiveJobs() },
    ]);
  });
