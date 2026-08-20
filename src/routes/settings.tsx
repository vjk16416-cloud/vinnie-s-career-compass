import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  DRIVE_READ_ERROR,
  getGoogleProviderToken,
  type GoogleDriveFile,
  listDriveFolderFiles,
  startGoogleDriveConnection,
} from "@/lib/careeros/google-drive";
import { uid, useCareerOs } from "@/lib/careeros/store";

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
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getGoogleProviderToken().then((token) => {
      if (!cancelled) setDriveToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connectDrive() {
    const result = await startGoogleDriveConnection("/settings");
    if (result.error) toast.error(result.error);
  }

  async function refreshDriveFiles() {
    if (!driveToken) {
      toast.error("Connect Google Drive first.");
      return;
    }

    if (!s.googleDriveFolder.trim()) {
      toast.error("Add a Drive folder URL or ID first.");
      return;
    }

    setDriveLoading(true);
    try {
      const files = await listDriveFolderFiles(s.googleDriveFolder, driveToken);
      setDriveFiles(files);
      toast.success(`Found ${files.length} file${files.length === 1 ? "" : "s"} in Google Drive.`);
    } catch (error) {
      setDriveFiles([]);
      toast.error(error instanceof Error ? error.message : DRIVE_READ_ERROR);
    } finally {
      setDriveLoading(false);
    }
  }

  function registerDriveSource(file: GoogleDriveFile) {
    const alreadyRegistered = data.profileSources?.some(
      (source) => source.externalFileId === file.id,
    );
    if (alreadyRegistered) {
      toast.info("That Drive file is already registered as a CareerOS source.");
      return;
    }

    update((draft) => {
      draft.profileSources = [
        ...(draft.profileSources ?? []),
        {
          id: uid("source"),
          label: file.name,
          sourceType: "Other",
          modifiedAt: file.modifiedTime,
          ownership: "Confirmed mine",
          ingestionStatus: "Indexed",
          trust: "Evidence",
          externalFileId: file.id,
          externalUrl: file.webViewLink,
          notes:
            "Registered from Google Drive. CareerOS has indexed the file reference only; its contents are not automatically approved evidence.",
        },
      ];
      return draft;
    });
    toast.success(`${file.name} registered as a CareerOS source reference.`);
  }

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

        <Panel
          title="Google Drive source"
          description="Read-only access to your original CareerOS source documents."
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={driveToken ? "Status: Connected (read-only)" : "Status: Not connected"}
              tone={driveToken ? "success" : "warning"}
            />
            {!driveToken ? (
              <Button size="sm" variant="secondary" onClick={connectDrive}>
                Connect Google Drive
              </Button>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            CareerOS requests Google Drive read-only permission. It cannot delete, move, rename or
            edit your Drive files. Supabase remains the source of truth for live CareerOS workflow
            state.
          </p>

          <div className="mt-3 max-w-xl">
            <Label htmlFor="drive">Drive folder URL or ID</Label>
            <Input
              id="drive"
              className="mt-1.5"
              placeholder="Paste a Google Drive folder link or folder ID"
              value={s.googleDriveFolder}
              onChange={(e) =>
                update((d) => {
                  d.settings.googleDriveFolder = e.target.value;
                  return d;
                })
              }
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!driveToken || driveLoading}
                onClick={refreshDriveFiles}
              >
                {driveLoading ? "Reading Drive…" : "Refresh Drive files"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Registering a file stores its Drive reference in CareerOS. It does not automatically
              turn the document into verified evidence.
            </p>
          </div>

          {driveFiles.length ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Files in this folder</h3>
              <ul className="space-y-2">
                {driveFiles.map((file) => {
                  const registered = data.profileSources?.some(
                    (source) => source.externalFileId === file.id,
                  );
                  return (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/40 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.modifiedTime
                            ? `Modified ${new Date(file.modifiedTime).toLocaleString("en-GB")}`
                            : file.mimeType}
                        </p>
                      </div>
                      {file.webViewLink ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={file.webViewLink} target="_blank" rel="noreferrer">
                            Open in Drive
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={registered}
                        onClick={() => registerDriveSource(file)}
                      >
                        {registered ? "Registered" : "Register source"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
