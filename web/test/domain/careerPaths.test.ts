import { describe, expect, it } from "vitest";
import {
  CAREER_PATHS,
  careerPathFor,
  completedCareerPathIds,
  isCareerPathComplete,
  type CareerPathDefinition,
} from "@/lib/phaser/worldMap/careerPaths";
import {
  canSelectPrimaryJob,
  completedSecondaryJobIds,
  isTertiaryJobUnlocked,
  isSecondaryJobUnlocked,
  JOB_OPTIONS,
  SECONDARY_JOB_OPTIONS,
  secondaryJobsFor,
  TERTIARY_JOB_OPTIONS,
  tertiaryJobsFor,
  type JobId,
} from "@/lib/domain/player/jobs";

describe("career paths", () => {
  it("gives every primary job a detailed map with several dex destinations", () => {
    const primaryIds = JOB_OPTIONS.map((job) => job.id) as JobId[];
    expect(Object.keys(CAREER_PATHS).sort()).toEqual([...primaryIds].sort());

    primaryIds.forEach((jobId) => {
      const path = careerPathFor(jobId);
      expect(path.regions.length).toBeGreaterThanOrEqual(5);
      expect(path.regions.every(({ x, y }) => x > 0 && x < 960 && y > 50 && y < 540)).toBe(true);
      expect(path.regions.every(({ landmark }) => landmark !== undefined)).toBe(true);
      expect(path.regions.every(({ focusPoints }) => focusPoints.length >= 6)).toBe(true);
      expect(
        path.regions.every(({ landmark, focusPoints }) => {
          const absolutePoints = focusPoints.map(([x, y]) => [x + landmark.x, y + landmark.y]);
          const xs = absolutePoints.map(([x]) => x);
          const ys = absolutePoints.map(([, y]) => y);
          return (
            Math.min(...xs) === landmark.x - landmark.width / 2 &&
            Math.max(...xs) === landmark.x + landmark.width / 2 &&
            Math.min(...ys) === landmark.y - landmark.height / 2 &&
            Math.max(...ys) === landmark.y + landmark.height / 2
          );
        })
      ).toBe(true);
      expect(
        path.regions.every(({ landmark }) =>
          landmark
            ? landmark.x - landmark.width / 2 >= 0 &&
              landmark.x + landmark.width / 2 <= 960 &&
              landmark.y - landmark.height / 2 >= 0 &&
              landmark.y + landmark.height / 2 <= 540
            : true
        )
      ).toBe(true);
    });
  });

  it("keeps future tier-two identities modeled while the UI can render them as mysteries", () => {
    expect(SECONDARY_JOB_OPTIONS.map((job) => job.id)).toContain("fullstack-engineer");
    expect(SECONDARY_JOB_OPTIONS.map((job) => job.id)).toContain("ml-developer");
    expect(secondaryJobsFor("backend").length).toBeGreaterThan(1);
  });
});

describe("primary job changes", () => {
  const path = {
    ...CAREER_PATHS.frontend,
    completionCaptureIds: ["html-css-final", "javascript-final"],
  } satisfies CareerPathDefinition;

  it("derives path completion only when every required chapter capture exists", () => {
    expect(isCareerPathComplete(path, new Set())).toBe(false);
    expect(isCareerPathComplete(path, new Set(["html-css-final"]))).toBe(false);
    expect(isCareerPathComplete(path, new Set(["html-css-final", "javascript-final"]))).toBe(true);
  });

  it("does not treat a path with no released completion requirements as complete", () => {
    expect(isCareerPathComplete(CAREER_PATHS.frontend, new Set())).toBe(false);
  });

  it("locks another primary job until the current path is complete", () => {
    expect(canSelectPrimaryJob("frontend", "backend", false)).toBe(false);
    expect(canSelectPrimaryJob("frontend", "frontend", false)).toBe(true);
    expect(canSelectPrimaryJob("frontend", "backend", true)).toBe(true);
    expect(canSelectPrimaryJob("junior", "backend", false)).toBe(true);
  });

  it("unlocks only the tier-two jobs whose two primary paths are complete", () => {
    const completed = new Set<JobId>(["frontend", "backend"]);
    expect(isSecondaryJobUnlocked(SECONDARY_JOB_OPTIONS[0], completed)).toBe(true);
    expect(isSecondaryJobUnlocked(SECONDARY_JOB_OPTIONS[1], completed)).toBe(false);
  });

  it("maps each tier-two job to one tier-three mastery path", () => {
    SECONDARY_JOB_OPTIONS.forEach((secondary) => {
      const [tertiary] = tertiaryJobsFor(secondary.id);
      expect(tertiary?.requires).toBe(secondary.id);
    });
    expect(TERTIARY_JOB_OPTIONS).toHaveLength(SECONDARY_JOB_OPTIONS.length);
  });

  it("unlocks tier three only after its tier-two mastery captures are complete", () => {
    const fullstack = {
      ...SECONDARY_JOB_OPTIONS[0],
      masteryCaptureIds: ["fullstack-capstone"],
    };
    const completed = completedSecondaryJobIds(new Set(["fullstack-capstone"]), [fullstack]);

    expect(isTertiaryJobUnlocked(TERTIARY_JOB_OPTIONS[0], completed)).toBe(true);
    expect(isTertiaryJobUnlocked(TERTIARY_JOB_OPTIONS[1], completed)).toBe(false);
  });

  it("lists every primary path completed by the captured requirements", () => {
    const paths = {
      ...CAREER_PATHS,
      frontend: { ...CAREER_PATHS.frontend, completionCaptureIds: ["frontend-final"] },
      backend: { ...CAREER_PATHS.backend, completionCaptureIds: ["backend-final"] },
    };

    expect(completedCareerPathIds(new Set(["frontend-final", "backend-final"]), paths)).toEqual(
      new Set(["frontend", "backend"])
    );
  });
});
