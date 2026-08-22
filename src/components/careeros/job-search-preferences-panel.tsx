import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  JobEmploymentType,
  JobSearchPreferences,
  JobWorkplaceType,
} from "@/lib/careeros/job-discovery.types";

const WORKPLACE_TYPES: JobWorkplaceType[] = ["Remote", "Hybrid", "On-site"];
const EMPLOYMENT_TYPES: JobEmploymentType[] = ["Permanent", "Contract", "Fixed-term"];

function listText(values: string[]) {
  return values.join(", ");
}

function parseList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function toggleValue<T extends string>(values: T[], value: T, checked: boolean) {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

export function JobSearchPreferencesPanel({
  preferences,
  onSave,
  saving = false,
}: {
  preferences: JobSearchPreferences;
  onSave?: (next: JobSearchPreferences) => void | Promise<void>;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState(preferences);

  useEffect(() => setDraft(preferences), [preferences]);

  function markOverride<K extends keyof JobSearchPreferences>(
    field: K,
    value: JobSearchPreferences[K],
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      manualOverrides: { ...current.manualOverrides, [field]: true },
      updatedAt: new Date().toISOString(),
    }));
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="job-preferences-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="job-preferences-heading" className="text-base font-semibold">
            Job Search Preferences
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            CareerOS starts from your Career Profile. Anything you edit here becomes your explicit override.
          </p>
        </div>
        {onSave ? (
          <Button type="button" onClick={() => void onSave(draft)} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="job-pref-exact">Preferred role titles</Label>
          <Input
            id="job-pref-exact"
            className="mt-1.5"
            value={listText(draft.exactTitles)}
            onChange={(event) => markOverride("exactTitles", parseList(event.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="job-pref-adjacent">Adjacent roles</Label>
          <Input
            id="job-pref-adjacent"
            className="mt-1.5"
            value={listText(draft.adjacentTitles)}
            onChange={(event) => markOverride("adjacentTitles", parseList(event.target.value))}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.adjacentTitles.map((title) => (
              <span key={title} className="rounded-full border border-border px-2 py-0.5 text-xs">
                {title}
              </span>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="job-pref-location">Locations</Label>
          <Input
            id="job-pref-location"
            className="mt-1.5"
            value={listText(draft.locations)}
            onChange={(event) => markOverride("locations", parseList(event.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="job-pref-salary">Minimum salary</Label>
          <Input
            id="job-pref-salary"
            className="mt-1.5"
            type="number"
            min={0}
            inputMode="numeric"
            value={draft.salaryMin ?? ""}
            placeholder="Leave blank if not set"
            onChange={(event) =>
              markOverride("salaryMin", event.target.value ? Number(event.target.value) : null)
            }
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <fieldset>
          <legend className="text-sm font-medium">Working arrangement</legend>
          <div className="mt-2 space-y-2">
            {WORKPLACE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.workplaceTypes.includes(type)}
                  onChange={(event) =>
                    markOverride(
                      "workplaceTypes",
                      toggleValue(draft.workplaceTypes, type, event.target.checked),
                    )
                  }
                />
                {type}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Employment type</legend>
          <div className="mt-2 space-y-2">
            {EMPLOYMENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.employmentTypes.includes(type)}
                  onChange={(event) =>
                    markOverride(
                      "employmentTypes",
                      toggleValue(draft.employmentTypes, type, event.target.checked),
                    )
                  }
                />
                {type}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Search scope</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includeUk}
                onChange={(event) => markOverride("includeUk", event.target.checked)}
              />
              UK-based roles
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includeGlobalUkHireable}
                onChange={(event) =>
                  markOverride("includeGlobalUkHireable", event.target.checked)
                }
              />
              Global roles hireable from the UK
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includeRelocationSponsorship}
                onChange={(event) =>
                  markOverride("includeRelocationSponsorship", event.target.checked)
                }
              />
              Relocation or visa sponsorship
            </label>
          </div>
        </fieldset>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          aria-label="Email daily shortlist"
          checked={draft.emailAlertsEnabled}
          onChange={(event) => markOverride("emailAlertsEnabled", event.target.checked)}
        />
        <span>
          <span className="font-medium">Email daily shortlist</span>
          <span className="ml-1 text-muted-foreground">
            Send fresh active matches once per day when email delivery is configured.
          </span>
        </span>
      </label>
    </section>
  );
}
