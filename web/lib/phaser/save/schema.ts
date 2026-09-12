export interface StoredCapture {
  id: string;
  capturedAt: string;
}

interface StoredGameStateV1 {
  version: 1;
  captures: StoredCapture[];
  selectedJob?: string;
  tutorialOnboardingSeen?: boolean;
}

export interface StoredGameStateV2 {
  version: 2;
  progress: {
    captures: StoredCapture[];
  };
  player: {
    primaryJobId: string;
    secondaryJobId: string | null;
    tertiaryJobId: string | null;
  };
  ui: {
    tutorialOnboardingSeen: boolean;
  };
}

export interface SaveSnapshot {
  captures: StoredCapture[];
  primaryJobId: string;
  secondaryJobId: string | null;
  tertiaryJobId: string | null;
  tutorialOnboardingSeen: boolean;
}

export function createSave(snapshot: SaveSnapshot): StoredGameStateV2 {
  return {
    version: 2,
    progress: { captures: snapshot.captures },
    player: {
      primaryJobId: snapshot.primaryJobId,
      secondaryJobId: snapshot.secondaryJobId,
      tertiaryJobId: snapshot.tertiaryJobId,
    },
    ui: { tutorialOnboardingSeen: snapshot.tutorialOnboardingSeen },
  };
}

/** Accepts both the current save and the original flat v1 shape. */
export function parseSave(raw: string): StoredGameStateV2 | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  if (value.version === 1) return migrateV1(value);
  if (value.version !== 2 || !isRecord(value.progress) || !isRecord(value.player) || !isRecord(value.ui)) {
    return undefined;
  }
  if (!Array.isArray(value.progress.captures)) return undefined;

  return createSave({
    captures: validCaptures(value.progress.captures),
    primaryJobId: typeof value.player.primaryJobId === "string" ? value.player.primaryJobId : "junior",
    secondaryJobId: typeof value.player.secondaryJobId === "string" ? value.player.secondaryJobId : null,
    tertiaryJobId: typeof value.player.tertiaryJobId === "string" ? value.player.tertiaryJobId : null,
    tutorialOnboardingSeen: value.ui.tutorialOnboardingSeen === true,
  });
}

function migrateV1(value: Record<string, unknown>): StoredGameStateV2 | undefined {
  if (!Array.isArray(value.captures)) return undefined;
  const old = value as unknown as StoredGameStateV1;
  return createSave({
    captures: validCaptures(old.captures),
    primaryJobId: typeof old.selectedJob === "string" ? old.selectedJob : "junior",
    secondaryJobId: null,
    tertiaryJobId: null,
    tutorialOnboardingSeen: old.tutorialOnboardingSeen === true,
  });
}

function validCaptures(value: unknown[]): StoredCapture[] {
  return value.filter(
    (entry): entry is StoredCapture =>
      isRecord(entry) && typeof entry.id === "string" && typeof entry.capturedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
