import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/careeros/app-shell";
import { Panel, StatusPill } from "@/components/careeros/ui-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
        content: "Data sources, optional review step and cloud storage controls.",
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
        <Panel title="CareerOS storage">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Supabase cloud state" tone="info" />
            <span className="text-sm text-muted-foreground">
              Supabase is the canonical CareerOS store. This browser keeps a local cache for
              resilience and recovery.
            </span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="mt-3" size="sm" variant="secondary">
                Reset to seeded data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset CareerOS to seeded data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This replaces your current CareerOS state with the seeded career record. The
                  change will sync across your devices after it is saved to Supabase.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetToSeed}>Reset CareerOS</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
