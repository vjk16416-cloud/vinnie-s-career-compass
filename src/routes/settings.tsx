import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCareerOs } from "@/lib/careeros/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareerOS" },
      {
        name: "description",
        content: "Data sources, optional review step and local storage controls.",
      },
      { property: "og:title", content: "Settings — CareerOS" },
      {
        property: "og:description",
        content: "Control data sources and the optional reviewer step.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data, update, resetToSeed } = useCareerOs();
  const s = data.settings;

  return (
    <AppShell title="Settings" subtitle="Data sources and optional integrations">
      <div className="space-y-4">
        <Panel title="Data source">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Local seeded data" tone="info" />
            <span className="text-sm text-muted-foreground">
              Everything lives in this browser. No external system is connected.
            </span>
          </div>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => {
              resetToSeed();
              toast.success("Local data reset to the seeded career record.");
            }}
          >
            Reset to seeded data
          </Button>
        </Panel>

        <Panel title="Google Drive source" description="Future integration target — not connected.">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Status: Not connected" tone="warning" />
          </div>
          <div className="mt-3 max-w-md">
            <Label htmlFor="drive">Intended Drive folder</Label>
            <Input
              id="drive"
              className="mt-1.5"
              placeholder="e.g. /CareerOS/Applications"
              value={s.googleDriveFolder}
              onChange={(e) =>
                update((d) => {
                  d.settings.googleDriveFolder = e.target.value;
                  return d;
                })
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Saved as a preference only. CareerOS will not display Drive content until a real
              connection exists.
            </p>
          </div>
        </Panel>

        <Panel
          title="Claude review (optional, not active)"
          description="A future second-opinion review step. Off by default; nothing is sent anywhere."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="claude"
              checked={s.claudeReviewEnabled}
              onCheckedChange={(v) =>
                update((d) => {
                  d.settings.claudeReviewEnabled = v;
                  return d;
                })
              }
            />
            <Label htmlFor="claude">Show the reviewer placeholder in workspaces</Label>
          </div>
          <div className="mt-3 rounded-md border border-border bg-surface-2/40 p-3 text-xs text-muted-foreground">
            <p className="text-foreground">Compact review pack (design intent)</p>
            <ul className="mt-1.5 space-y-1">
              <li>· Job description essentials only</li>
              <li>· Compatibility summary and sub-scores</li>
              <li>· Selected CV text</li>
              <li>· Cover letter text</li>
              <li>· Evidence risk flags</li>
            </ul>
            <p className="mt-2">
              The full archive is never sent. No paid API is required for CareerOS to work.
            </p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
