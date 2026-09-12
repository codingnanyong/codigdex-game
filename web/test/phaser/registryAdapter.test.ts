import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { DEX_MONSTERS } from "@/lib/domain/chapters";
import {
  JOB_REGISTRY_KEY,
  SECONDARY_JOB_REGISTRY_KEY,
  TERTIARY_JOB_REGISTRY_KEY,
} from "@/lib/domain/player/jobs";
import {
  hasSavedProgress,
  hydrateRegistry,
  LEGACY_SAVE_STORAGE_KEY,
  persistRegistry,
  readDexState,
  resetGameProgress,
  SAVE_STORAGE_KEY,
  TUTORIAL_ONBOARDING_SEEN_KEY,
} from "@/lib/phaser/registryAdapter";

// Phaser touches `window` on import; the adapter only needs its event names.
vi.mock("phaser", () => ({
  default: { Data: { Events: { SET_DATA: "setdata", CHANGE_DATA: "changedata" } } },
}));

function fakeRegistry(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get: (key: string) => data.get(key),
    set: (key: string, value: unknown) => void data.set(key, value),
    events: { on: () => undefined },
  } as unknown as Phaser.Data.DataManager;
}

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const failingStorage = {
  getItem: () => {
    throw new Error("storage unavailable");
  },
  setItem: () => {
    throw new Error("quota exceeded");
  },
  removeItem: () => {
    throw new Error("storage unavailable");
  },
} as unknown as Storage;

const savedGame = (save: unknown) => memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });

const [first, second, third] = DEX_MONSTERS;

describe("hydrateRegistry", () => {
  it("restores captures in dex order from today's monster definitions", () => {
    const registry = fakeRegistry();
    hydrateRegistry(
      registry,
      savedGame({
        version: 1,
        captures: [
          { id: second.id, capturedAt: "2026-09-02T00:00:00.000Z" },
          { id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" },
        ],
        selectedJob: "devops",
        tutorialOnboardingSeen: true,
      })
    );

    const { cards } = readDexState(registry);
    expect(cards.map((card) => card.id)).toEqual([first.id, second.id]);
    expect(cards[0]).toMatchObject({ name: first.name, snippet: first.snippet, capturedAt: "2026-09-01T00:00:00.000Z" });
    expect(registry.get(JOB_REGISTRY_KEY)).toBe("devops");
    expect(registry.get(TUTORIAL_ONBOARDING_SEEN_KEY)).toBe(true);
  });

  it("drops captures of monsters that no longer exist and entries with the wrong shape", () => {
    const registry = fakeRegistry();
    hydrateRegistry(
      registry,
      savedGame({
        version: 1,
        captures: [
          { id: "removed-monster", capturedAt: "2026-09-01T00:00:00.000Z" },
          null,
          { id: second.id },
          { id: third.id, capturedAt: 42 },
          { id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" },
        ],
      })
    );

    expect(readDexState(registry).cards.map((card) => card.id)).toEqual([first.id]);
  });

  it("maps legacy and unknown job ids onto a playable job", () => {
    const legacy = fakeRegistry();
    hydrateRegistry(legacy, savedGame({ version: 1, captures: [], selectedJob: "data" }));
    expect(legacy.get(JOB_REGISTRY_KEY)).toBe("data-analyst");

    const unknown = fakeRegistry();
    hydrateRegistry(unknown, savedGame({ version: 1, captures: [], selectedJob: "wizard" }));
    expect(unknown.get(JOB_REGISTRY_KEY)).toBe("junior");
    expect(unknown.get(TUTORIAL_ONBOARDING_SEEN_KEY)).toBe(false);
  });

  it("migrates the legacy storage slot into the nested v2 save", () => {
    const storage = memoryStorage({
      [LEGACY_SAVE_STORAGE_KEY]: JSON.stringify({
        version: 1,
        captures: [{ id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" }],
        selectedJob: "frontend",
        tutorialOnboardingSeen: true,
      }),
    });
    const registry = fakeRegistry();

    hydrateRegistry(registry, storage);

    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!)).toEqual({
      version: 2,
      progress: { captures: [{ id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" }] },
      player: { primaryJobId: "frontend", secondaryJobId: null, tertiaryJobId: null },
      ui: { tutorialOnboardingSeen: true },
    });
  });

  it.each([
    ["malformed JSON", memoryStorage({ [SAVE_STORAGE_KEY]: "{not json" })],
    ["an unknown save version", savedGame({ version: 2, captures: [] })],
    ["captures that are not an array", savedGame({ version: 1, captures: { id: first.id } })],
    ["a JSON null save", memoryStorage({ [SAVE_STORAGE_KEY]: "null" })],
    ["no save at all", memoryStorage()],
    ["storage that throws on read", failingStorage],
  ])("leaves the registry untouched for %s", (_label, storage) => {
    const registry = fakeRegistry();
    expect(() => hydrateRegistry(registry, storage)).not.toThrow();
    expect(registry.get("cards")).toBeUndefined();
    expect(registry.get(JOB_REGISTRY_KEY)).toBeUndefined();
  });

  it("does nothing when browser storage is unavailable", () => {
    const registry = fakeRegistry();
    expect(() => hydrateRegistry(registry)).not.toThrow();
    expect(registry.get("cards")).toBeUndefined();
  });
});

describe("persistRegistry", () => {
  it("round-trips captures, job, and onboarding through storage", () => {
    const storage = memoryStorage();
    const source = fakeRegistry();
    hydrateRegistry(
      source,
      savedGame({
        version: 1,
        captures: [{ id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" }],
        selectedJob: "backend",
        tutorialOnboardingSeen: true,
      })
    );
    persistRegistry(source, storage);

    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!)).toEqual({
      version: 2,
      progress: { captures: [{ id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" }] },
      player: { primaryJobId: "backend", secondaryJobId: null, tertiaryJobId: null },
      ui: { tutorialOnboardingSeen: true },
    });

    const restored = fakeRegistry();
    hydrateRegistry(restored, storage);
    expect(readDexState(restored)).toEqual(readDexState(source));
    expect(restored.get(JOB_REGISTRY_KEY)).toBe("backend");
    expect(restored.get(TUTORIAL_ONBOARDING_SEEN_KEY)).toBe(true);
  });

  it("keeps play going when storage rejects the write", () => {
    expect(() => persistRegistry(fakeRegistry(), failingStorage)).not.toThrow();
  });
});

describe("resetGameProgress", () => {
  it("clears the registry and leaves an empty save behind", () => {
    const storage = savedGame({
      version: 1,
      captures: [{ id: first.id, capturedAt: "2026-09-01T00:00:00.000Z" }],
      selectedJob: "frontend",
      tutorialOnboardingSeen: true,
    });
    const registry = fakeRegistry();
    hydrateRegistry(registry, storage);

    resetGameProgress(registry, storage);

    expect(readDexState(registry).cards).toEqual([]);
    expect(registry.get(JOB_REGISTRY_KEY)).toBe("junior");
    expect(registry.get(SECONDARY_JOB_REGISTRY_KEY)).toBeNull();
    expect(registry.get(TERTIARY_JOB_REGISTRY_KEY)).toBeNull();
    expect(registry.get(TUTORIAL_ONBOARDING_SEEN_KEY)).toBe(false);
    expect(hasSavedProgress(registry)).toBe(false);
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!)).toEqual({
      version: 2,
      progress: { captures: [] },
      player: { primaryJobId: "junior", secondaryJobId: null, tertiaryJobId: null },
      ui: { tutorialOnboardingSeen: false },
    });
  });

  it("still resets the registry when storage is unavailable", () => {
    const registry = fakeRegistry({ cards: [{ id: first.id }], [TUTORIAL_ONBOARDING_SEEN_KEY]: true });
    expect(() => resetGameProgress(registry, failingStorage)).not.toThrow();
    expect(readDexState(registry).cards).toEqual([]);
    expect(registry.get(TUTORIAL_ONBOARDING_SEEN_KEY)).toBe(false);
  });
});

describe("hasSavedProgress", () => {
  it("is false for a fresh game", () => {
    expect(hasSavedProgress(fakeRegistry())).toBe(false);
  });

  it("is true once a card is captured or the tutorial onboarding was seen", () => {
    expect(hasSavedProgress(fakeRegistry({ cards: [{ id: first.id }] }))).toBe(true);
    expect(hasSavedProgress(fakeRegistry({ [TUTORIAL_ONBOARDING_SEEN_KEY]: true }))).toBe(true);
  });
});
