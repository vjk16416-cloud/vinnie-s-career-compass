import type { JobBoardFilters, JobBoardListing, JobRecord, ScanResult } from "./types";

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export function safeHttpUrl(value: string | undefined): string | undefined {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;

  try {
    const url = new URL(cleaned);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function normaliseJobBoardListing(listing: JobBoardListing): JobBoardListing {
  return {
    ...listing,
    title: listing.title.trim(),
    company: listing.company.trim(),
    location: listing.location.trim(),
    description: listing.description.trim(),
    sourceName: cleanOptional(listing.sourceName),
    sourceUrl: safeHttpUrl(listing.sourceUrl),
    applyUrl: safeHttpUrl(listing.applyUrl),
    salary: cleanOptional(listing.salary),
    workplaceType: cleanOptional(listing.workplaceType),
    employmentType: cleanOptional(listing.employmentType),
    closingDate: cleanOptional(listing.closingDate),
    postedAt: cleanOptional(listing.postedAt),
  };
}

export function listingToJobRecord(
  source: JobBoardListing,
  id: string,
  createdAt = new Date().toISOString(),
): JobRecord {
  const listing = normaliseJobBoardListing(source);
  const location = [listing.location, listing.workplaceType].filter(Boolean).join(" · ");

  return {
    id,
    company: listing.company || "Unspecified company",
    title: listing.title || "Unspecified role",
    location: location || "Unspecified",
    url: listing.sourceUrl ?? listing.applyUrl,
    description: listing.description,
    createdAt,
    sourceType: "board",
    extractionCompleteness: "complete",
    extractionMethod: "structured",
    descriptionWordCount: wordCount(listing.description),
    boardListingId: listing.id,
  };
}

export function latestAnalysisForListing(
  listingId: string,
  jobs: JobRecord[],
  scans: ScanResult[],
): { job: JobRecord; scan: ScanResult } | null {
  const jobsById = new Map(
    jobs.filter((job) => job.boardListingId === listingId).map((job) => [job.id, job]),
  );

  const scan = scans
    .filter((candidate) => jobsById.has(candidate.jobId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!scan) return null;
  const job = jobsById.get(scan.jobId);
  return job ? { job, scan } : null;
}

export function filterJobBoardListings(
  listings: JobBoardListing[],
  filters: JobBoardFilters,
): JobBoardListing[] {
  const query = filters.query.trim().toLowerCase();

  return listings.filter((listing) => {
    if (filters.savedOnly && !listing.saved) return false;
    if (filters.workplaceType && listing.workplaceType !== filters.workplaceType) return false;
    if (filters.employmentType && listing.employmentType !== filters.employmentType) return false;

    if (!query) return true;
    const haystack = [listing.title, listing.company, listing.location, listing.description]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function jobBoardFilterOptions(listings: JobBoardListing[]): {
  workplaceTypes: string[];
  employmentTypes: string[];
} {
  const workplaceTypes = Array.from(
    new Set(listings.map((listing) => listing.workplaceType?.trim()).filter(Boolean) as string[]),
  ).sort((left, right) => left.localeCompare(right));
  const employmentTypes = Array.from(
    new Set(listings.map((listing) => listing.employmentType?.trim()).filter(Boolean) as string[]),
  ).sort((left, right) => left.localeCompare(right));

  return { workplaceTypes, employmentTypes };
}
