import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  JobDiscoveryFilters,
  JobDiscoverySort,
  JobEmploymentType,
  JobLiveStatus,
  JobMatchType,
  JobWorkplaceType,
} from "@/lib/careeros/job-discovery.types";

export const EMPTY_JOB_DISCOVERY_FILTERS: JobDiscoveryFilters = {
  search: "",
  fitBands: [],
  sources: [],
  matchTypes: [],
  industries: [],
  seniority: [],
  locations: [],
  workplaceTypes: [],
  employmentTypes: [],
  ukScopes: [],
  sponsorship: [],
  statuses: [],
  minSalary: null,
  postedWithinDays: null,
  closingSoonOnly: false,
  savedOnly: false,
  newTodayOnly: false,
};

function toggle<T extends string>(values: T[], value: T, checked: boolean) {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

export function JobBoardFilters({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  sources,
  industries,
  seniority,
  locations,
}: {
  filters: JobDiscoveryFilters;
  sort: JobDiscoverySort;
  onFiltersChange: (filters: JobDiscoveryFilters) => void;
  onSortChange: (sort: JobDiscoverySort) => void;
  sources: string[];
  industries: string[];
  seniority: string[];
  locations: string[];
}) {
  const [open, setOpen] = useState(false);

  function set<K extends keyof JobDiscoveryFilters>(field: K, value: JobDiscoveryFilters[K]) {
    onFiltersChange({ ...filters, [field]: value });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            aria-label="Search jobs"
            placeholder="Search title, company or location"
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
            Filters
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            aria-label="Sort jobs"
            className="rounded-md border border-input bg-background px-2 py-2"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as JobDiscoverySort)}
          >
            <option value="best_fit">Best fit</option>
            <option value="newest">Newest</option>
            <option value="closing_soon">Closing soon</option>
            <option value="salary">Salary</option>
          </select>
        </label>
      </div>

      {open ? (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterGroup label="Match type">
            {(["exact", "adjacent", "other"] satisfies JobMatchType[]).map((value) => (
              <Check
                key={value}
                label={
                  value === "exact"
                    ? "Exact title"
                    : value === "adjacent"
                      ? "Adjacent role"
                      : "Other plausible"
                }
                checked={filters.matchTypes.includes(value)}
                onChange={(checked) =>
                  set("matchTypes", toggle(filters.matchTypes, value, checked))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            {(["active", "closing_soon", "uncertain", "expired"] satisfies JobLiveStatus[]).map(
              (value) => (
                <Check
                  key={value}
                  label={value.replace("_", " ")}
                  checked={filters.statuses.includes(value)}
                  onChange={(checked) => set("statuses", toggle(filters.statuses, value, checked))}
                />
              ),
            )}
          </FilterGroup>

          <FilterGroup label="Working arrangement">
            {(["Remote", "Hybrid", "On-site"] satisfies JobWorkplaceType[]).map((value) => (
              <Check
                key={value}
                label={value}
                checked={filters.workplaceTypes.includes(value)}
                onChange={(checked) =>
                  set("workplaceTypes", toggle(filters.workplaceTypes, value, checked))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Employment type">
            {(["Permanent", "Contract", "Fixed-term"] satisfies JobEmploymentType[]).map(
              (value) => (
                <Check
                  key={value}
                  label={value}
                  checked={filters.employmentTypes.includes(value)}
                  onChange={(checked) =>
                    set("employmentTypes", toggle(filters.employmentTypes, value, checked))
                  }
                />
              ),
            )}
          </FilterGroup>

          <SelectFilter
            label="Source"
            value={filters.sources[0] ?? ""}
            options={sources}
            onChange={(value) => set("sources", value ? [value] : [])}
          />
          <SelectFilter
            label="Industry"
            value={filters.industries[0] ?? ""}
            options={industries}
            onChange={(value) => set("industries", value ? [value] : [])}
          />
          <SelectFilter
            label="Seniority"
            value={filters.seniority[0] ?? ""}
            options={seniority}
            onChange={(value) => set("seniority", value ? [value] : [])}
          />
          <SelectFilter
            label="Location"
            value={filters.locations[0] ?? ""}
            options={locations}
            onChange={(value) => set("locations", value ? [value] : [])}
          />

          <label className="text-sm">
            <span className="font-medium">Minimum salary</span>
            <Input
              className="mt-1.5"
              type="number"
              min={0}
              value={filters.minSalary ?? ""}
              onChange={(event) =>
                set("minSalary", event.target.value ? Number(event.target.value) : null)
              }
            />
          </label>

          <label className="text-sm">
            <span className="font-medium">Date posted</span>
            <select
              className="mt-1.5 w-full rounded-md border border-input bg-background px-2 py-2"
              value={filters.postedWithinDays ?? ""}
              onChange={(event) =>
                set("postedWithinDays", event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Any time</option>
              <option value="1">Past 24 hours</option>
              <option value="3">Past 3 days</option>
              <option value="7">Past week</option>
              <option value="14">Past fortnight</option>
            </select>
          </label>

          <FilterGroup label="UK and mobility">
            <Check
              label="UK eligibility confirmed"
              checked={filters.ukScopes.includes("confirmed")}
              onChange={(checked) =>
                set("ukScopes", toggle(filters.ukScopes, "confirmed", checked))
              }
            />
            <Check
              label="UK eligibility likely"
              checked={filters.ukScopes.includes("likely")}
              onChange={(checked) => set("ukScopes", toggle(filters.ukScopes, "likely", checked))}
            />
            <Check
              label="Sponsorship confirmed"
              checked={filters.sponsorship.includes("confirmed")}
              onChange={(checked) =>
                set("sponsorship", toggle(filters.sponsorship, "confirmed", checked))
              }
            />
            <Check
              label="Sponsorship possible"
              checked={filters.sponsorship.includes("possible")}
              onChange={(checked) =>
                set("sponsorship", toggle(filters.sponsorship, "possible", checked))
              }
            />
          </FilterGroup>

          <FilterGroup label="Quick filters">
            <Check
              label="Closing soon"
              checked={filters.closingSoonOnly}
              onChange={(checked) => set("closingSoonOnly", checked)}
            />
            <Check
              label="Saved only"
              checked={filters.savedOnly}
              onChange={(checked) => set("savedOnly", checked)}
            />
            <Check
              label="New today"
              checked={filters.newTodayOnly}
              onChange={(checked) => set("newTodayOnly", checked)}
            />
          </FilterGroup>

          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onFiltersChange(EMPTY_JOB_DISCOVERY_FILTERS)}
            >
              Clear filters
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm capitalize">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="mt-1.5 w-full rounded-md border border-input bg-background px-2 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
