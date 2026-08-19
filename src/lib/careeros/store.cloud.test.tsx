import "@/test/dom";
import "@/test/setup";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerStateRepository, CareerStateRow } from "./cloud-state.repository";
import { CareerOsProvider, useCareerOs } from "./store";
import { createCareerOsData } from "./profile-data";
import { readCareerOsCache, writeCareerOsCache } from "./local-cache";
import type { CareerOsData } from "./types";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function row(data: CareerOsData): CareerStateRow {
  return {
    userId: "user-1",
    schemaVersion: 1,
    data,
    createdAt: "2026-08-18T20:00:00.000Z",
    updatedAt: "2026-08-18T20:00:00.000Z",
  };
}

function repositoryWith(
  load: () => Promise<CareerStateRow | null>,
  save: (userId: string, data: CareerOsData, schemaVersion: number) => Promise<CareerStateRow>,
): CareerStateRepository {
  return {
    load: vi.fn(load),
    create: vi.fn(async (userId, data, schemaVersion) => ({ ...row(data), userId, schemaVersion })),
    save: vi.fn(save),
  };
}

function Probe() {
  const store = useCareerOs() as ReturnType<typeof useCareerOs> & {
    syncStatus: string;
    syncMessage: string;
    canEdit: boolean;
  };

  return (
    <div>
      <p>{store.syncStatus}</p>
      <p data-testid="headline">{store.data.profile.headline}</p>
      <p data-testid="location">{store.data.profile.location}</p>
      <p data-testid="editable">{String(store.canEdit)}</p>
      <button
        type="button"
        onClick={() =>
          store.update((draft) => {
            draft.profile.headline = "Changed headline";
            return draft;
          })
        }
      >
        Change headline
      </button>
      <button
        type="button"
        onClick={() =>
          store.update((draft) => {
            draft.profile.location = "Changed location";
            return draft;
          })
        }
      >
        Change location
      </button>
    </div>
  );
}

function renderStore(repository: CareerStateRepository) {
  return render(
    <CareerOsProvider userId="user-1" repository={repository}>
      <Probe />
    </CareerOsProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CareerOsProvider cloud persistence", () => {
  it("does not update durable cache until the cloud save succeeds", async () => {
    const initial = createCareerOsData();
    const save = deferred<CareerStateRow>();
    const repository = repositoryWith(
      async () => row(initial),
      async () => save.promise,
    );

    renderStore(repository);
    await screen.findByText("synced");

    fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
    expect(screen.getByText("saving")).toBeInTheDocument();
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe(initial.profile.headline);

    const changed = structuredClone(initial);
    changed.profile.headline = "Changed headline";
    save.resolve(row(changed));

    await screen.findByText("synced");
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe("Changed headline");
  });

  it("rolls back to the last confirmed state when a save fails", async () => {
    const initial = createCareerOsData();
    const repository = repositoryWith(
      async () => row(initial),
      async () => {
        throw new Error("network");
      },
    );

    renderStore(repository);
    await screen.findByText("synced");

    fireEvent.click(screen.getByRole("button", { name: "Change headline" }));

    await screen.findByText("save-error");
    expect(screen.getByTestId("headline")).toHaveTextContent(initial.profile.headline);
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe(initial.profile.headline);
  });

  it("stays in saving state until every queued snapshot is confirmed", async () => {
    const initial = createCareerOsData();
    const pending: Array<ReturnType<typeof deferred<CareerStateRow>>> = [];
    const repository = repositoryWith(
      async () => row(initial),
      async (_userId, data) => {
        const current = deferred<CareerStateRow>();
        pending.push(current);
        return current.promise.then(() => row(data));
      },
    );

    renderStore(repository);
    await screen.findByText("synced");

    fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
    fireEvent.click(screen.getByRole("button", { name: "Change location" }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    pending[0]?.resolve(row(initial));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2));

    expect(screen.getByText("saving")).toBeInTheDocument();
    pending[1]?.resolve(row(initial));
    await screen.findByText("synced");
    expect(screen.getByTestId("headline")).toHaveTextContent("Changed headline");
    expect(screen.getByTestId("location")).toHaveTextContent("Changed location");
  });

  it("refuses mutations while using an offline cache", async () => {
    const cached = createCareerOsData();
    cached.profile.headline = "Cached headline";
    writeCareerOsCache(window.localStorage, cached);
    const repository = repositoryWith(
      async () => {
        throw new Error("network");
      },
      async (_userId, data) => row(data),
    );

    renderStore(repository);
    await screen.findByText("offline-cache");

    expect(screen.getByTestId("editable")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "Change headline" }));
    expect(screen.getByTestId("headline")).toHaveTextContent("Cached headline");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("requires an explicit choice before replacing divergent local data with cloud data", async () => {
    const cloud = createCareerOsData();
    cloud.profile.headline = "Cloud headline";
    const local = createCareerOsData();
    local.profile.headline = "Local work from this device";
    writeCareerOsCache(window.localStorage, local);
    const repository = repositoryWith(
      async () => row(cloud),
      async (_userId, data) => row(data),
    );

    renderStore(repository);

    await screen.findByRole("heading", { name: "Different CareerOS data found on this device" });
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe(
      "Local work from this device",
    );
    expect(repository.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep cloud version" }));

    await screen.findByText("synced");
    expect(screen.getByTestId("headline")).toHaveTextContent("Cloud headline");
    expect(screen.getByTestId("editable")).toHaveTextContent("true");
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe("Cloud headline");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("only replaces cloud data with the local version after the explicit save succeeds", async () => {
    const cloud = createCareerOsData();
    cloud.profile.headline = "Cloud headline";
    const local = createCareerOsData();
    local.profile.headline = "Local work from this device";
    writeCareerOsCache(window.localStorage, local);
    const save = deferred<CareerStateRow>();
    const repository = repositoryWith(
      async () => row(cloud),
      async (_userId, data) => save.promise.then(() => row(data)),
    );

    renderStore(repository);
    await screen.findByRole("heading", { name: "Different CareerOS data found on this device" });

    fireEvent.click(screen.getByRole("button", { name: "Use local version" }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe(
      "Local work from this device",
    );

    save.resolve(row(local));

    await screen.findByText("synced");
    expect(screen.getByTestId("headline")).toHaveTextContent("Local work from this device");
    expect(screen.getByTestId("editable")).toHaveTextContent("true");
    expect(readCareerOsCache(window.localStorage)?.profile.headline).toBe(
      "Local work from this device",
    );
  });
});
