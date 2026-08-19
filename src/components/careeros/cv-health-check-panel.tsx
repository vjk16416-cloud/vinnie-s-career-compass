import { Button } from "@/components/ui/button";
import type { CvHealthCheck } from "@/lib/careeros/generate";
import { Panel, ScoreBar, StatusPill } from "./ui-bits";

export function CvHealthCheckPanel({
  health,
  onRegenerate,
}: {
  health: CvHealthCheck;
  onRegenerate: () => void;
}) {
  return (
    <Panel title="CV scan / health check" description="Review before export.">
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreBar label="Role compatibility" value={health.compatibility} />
        <ScoreBar label="ATS / keyword coverage" value={health.atsCoverage} />
        <ScoreBar label="Responsibilities coverage" value={health.responsibilitiesCoverage} />
        <ScoreBar label="Evidence coverage" value={health.evidenceCoverage} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">Missing keywords</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {health.missingKeywords.length ? (
              health.missingKeywords.map((keyword) => (
                <StatusPill key={keyword} label={keyword} tone="warning" />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">None.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">Weak or vague bullets</h3>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {health.weakBullets.length ? (
              health.weakBullets.map((bullet) => <li key={bullet}>{bullet.trim()}</li>)
            ) : (
              <li>None flagged.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">
            Unsupported or unverified claims
          </h3>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {health.unsupportedClaims.length ? (
              health.unsupportedClaims.map((claim) => <li key={claim}>{claim}</li>)
            ) : (
              <li>None. Every claim traces to Verified evidence.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground">Formatting compliance</h3>
          <ul className="mt-1.5 space-y-1 text-sm">
            {health.formatting.map((item) => (
              <li key={item.rule} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-muted-foreground">{item.rule}</span>
                <StatusPill
                  label={item.pass ? "Pass" : "Check"}
                  tone={item.pass ? "success" : "warning"}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">Suggested refinements</h3>
        <ul className="mt-1.5 space-y-1.5 text-sm">
          {health.suggestions.length ? (
            health.suggestions.map((suggestion) => (
              <li key={suggestion.text} className="rounded-md border border-border p-2.5">
                {suggestion.text}
                {suggestion.evidenceId ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    Evidence ref: {suggestion.evidenceId}
                  </span>
                ) : null}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">No refinements suggested.</li>
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onRegenerate}>
          Create fresh draft
        </Button>
        <p className="text-xs text-muted-foreground">
          Suggestions are guidance only. A fresh draft is regenerated from approved profile items
          and verified evidence.
        </p>
      </div>
    </Panel>
  );
}
