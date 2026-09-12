import Phaser from "phaser";
import { isCommonPathComplete } from "@/lib/domain/chapters";
import { capturedIds } from "@/lib/domain/dex/capture";
import {
  canSelectPrimaryJob,
  findJob,
  findSecondaryJob,
  isSecondaryJobUnlocked,
  JOB_OPTIONS,
  JOB_REGISTRY_KEY,
  SECONDARY_JOB_REGISTRY_KEY,
  SECONDARY_JOB_OPTIONS,
  type JobId,
  type JobOption,
  type SecondaryJobOption,
} from "@/lib/domain/player/jobs";
import { PALETTE, PALETTE_HEX } from "../palette";
import { pixelText } from "../pixelFont";
import { readDexState } from "../registryAdapter";
import {
  applyPixelFontToScene,
  createButton,
  drawOrnateFrame,
  fitTextInside,
  showToast,
} from "../ui";
import {
  careerPathFor,
  completedCareerPathIds,
  isCareerPathComplete,
} from "../worldMap/careerPaths";

const JUNIOR_X = 105;
const PRIMARY_X = 390;
const SECONDARY_X = 800;
const JUNIOR_WIDTH = 170;
const PRIMARY_WIDTH = 286;
const SECONDARY_WIDTH = 222;
const CAREER_CENTER_Y = 262;
const ROW_Y = [106, 184, 262, 340, 418] as const;

/** Shows primary paths and reveals tier-two jobs unlocked by completed pairs. */
export class JobSelectScene extends Phaser.Scene {
  private toast?: Phaser.GameObjects.Text;
  private captured: ReadonlySet<string> = new Set();
  private selectedJobId: JobId | "junior" = "junior";
  private selectedPathComplete = false;
  private completedJobIds: ReadonlySet<JobId> = new Set();
  private selectedSecondaryJobId?: string;
  private commonPathComplete = false;

  constructor() {
    super("job-select");
  }

  preload() {
    JOB_OPTIONS.forEach((job) => this.load.image(job.textureKey!, job.assetPath!));
  }

  create() {
    const { width, height } = this.scale;
    this.toast = undefined;
    this.captured = capturedIds(readDexState(this.registry));
    this.commonPathComplete = isCommonPathComplete(this.captured);
    this.selectedJobId = findJob(this.registry.get(JOB_REGISTRY_KEY) as string | undefined).id;
    this.selectedPathComplete =
      this.selectedJobId !== "junior" &&
      isCareerPathComplete(careerPathFor(this.selectedJobId), this.captured);
    this.completedJobIds = completedCareerPathIds(this.captured);
    const storedSecondaryJob = findSecondaryJob(
      this.registry.get(SECONDARY_JOB_REGISTRY_KEY) as string | null | undefined
    );
    this.selectedSecondaryJobId =
      storedSecondaryJob && isSecondaryJobUnlocked(storedSecondaryJob, this.completedJobIds)
        ? storedSecondaryJob.id
        : undefined;
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.nightBrown, 1);

    this.add
      .text(width / 2, 28, "CAREER PATH · 전직 계보", {
        ...pixelText("subtitle"),
        color: PALETTE_HEX.cream,
      })
      .setOrigin(0.5);
    this.add
      .text(JUNIOR_X, 63, "전직 전", {
        ...pixelText("body"),
        color: PALETTE_HEX.mutedBrown,
      })
      .setOrigin(0.5);
    this.add
      .text(PRIMARY_X, 63, "1차 전직", {
        ...pixelText("body"),
        color: PALETTE_HEX.amber,
      })
      .setOrigin(0.5);
    this.add
      .text(SECONDARY_X, 63, "2차 전직", {
        ...pixelText("body"),
        color: PALETTE_HEX.mutedBrown,
      })
      .setOrigin(0.5);

    this.drawPromotionPaths();
    this.drawJuniorJob();
    JOB_OPTIONS.forEach((job, index) => {
      const selected = this.selectedJobId === job.id;
      const locked = !canSelectPrimaryJob(this.selectedJobId, job.id, this.selectedPathComplete);
      this.drawPrimaryJob(job, ROW_Y[index], selected, locked);
    });
    SECONDARY_JOB_OPTIONS.forEach((job, index) => this.drawSecondaryJob(job, index, ROW_Y[index]));

    createButton(this, width / 2, height - 28, 140, 32, "돌아가기", () => this.scene.start("world-map"));
    applyPixelFontToScene(this);
  }

  private drawPromotionPaths() {
    const indexByPrimary = new Map(JOB_OPTIONS.map((job, index) => [job.id, index]));
    const lines = this.add.graphics();

    const stroke = (points: Array<[number, number]>, active = false) => {
      const draw = () => {
        lines.beginPath();
        lines.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([x, y]) => lines.lineTo(x, y));
        lines.strokePath();
      };
      lines.lineStyle(5, PALETTE.ink, 1);
      draw();
      lines.lineStyle(2, active ? PALETTE.amber : PALETTE.mutedBrown, active ? 0.9 : 0.68);
      draw();
    };

    const strokeCurve = (
      start: [number, number],
      end: [number, number],
      active: boolean
    ) => {
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(...start),
        new Phaser.Math.Vector2(585, start[1]),
        new Phaser.Math.Vector2(640, end[1]),
        new Phaser.Math.Vector2(...end)
      );
      const points = curve.getPoints(24);
      lines.lineStyle(5, PALETTE.ink, 1);
      lines.strokePoints(points, false);
      lines.lineStyle(2, active ? PALETTE.amber : PALETTE.mutedBrown, active ? 0.92 : 0.68);
      lines.strokePoints(points, false);
    };

    const primaryBranchX = 220;
    stroke(
      [
        [JUNIOR_X + JUNIOR_WIDTH / 2, CAREER_CENTER_Y],
        [primaryBranchX, CAREER_CENTER_Y],
      ],
      this.commonPathComplete
    );
    stroke(
      [
        [primaryBranchX, ROW_Y[0]],
        [primaryBranchX, ROW_Y[ROW_Y.length - 1]],
      ],
      this.commonPathComplete
    );
    ROW_Y.forEach((y) =>
      stroke(
        [
          [primaryBranchX, y],
          [PRIMARY_X - PRIMARY_WIDTH / 2, y],
        ],
        this.commonPathComplete
      )
    );

    const connectionCount = new Map<JobId, number>();
    SECONDARY_JOB_OPTIONS.forEach((secondary) =>
      secondary.requires.forEach((jobId) =>
        connectionCount.set(jobId, (connectionCount.get(jobId) ?? 0) + 1)
      )
    );
    const connectionIndex = new Map<JobId, number>();

    SECONDARY_JOB_OPTIONS.forEach((secondary, secondaryIndex) => {
      secondary.requires.forEach((primaryId, branchIndex) => {
        const primaryIndex = indexByPrimary.get(primaryId)!;
        const portIndex = connectionIndex.get(primaryId) ?? 0;
        const portCount = connectionCount.get(primaryId) ?? 1;
        connectionIndex.set(primaryId, portIndex + 1);

        const startY = ROW_Y[primaryIndex] + (portIndex - (portCount - 1) / 2) * 12;
        const endY = ROW_Y[secondaryIndex] + (branchIndex === 0 ? -9 : 9);
        const active = this.completedJobIds.has(primaryId);
        strokeCurve(
          [PRIMARY_X + PRIMARY_WIDTH / 2, startY],
          [SECONDARY_X - SECONDARY_WIDTH / 2, endY],
          active
        );

        this.add
          .circle(SECONDARY_X - SECONDARY_WIDTH / 2, endY, 3, active ? PALETTE.amber : PALETTE.mutedBrown)
          .setStrokeStyle(1, PALETTE.ink);
      });
    });
  }

  private drawJuniorJob() {
    const frame = drawOrnateFrame(this, JUNIOR_X, CAREER_CENTER_Y, JUNIOR_WIDTH, 82, {
      fill: this.selectedJobId === "junior" ? PALETTE.sand : PALETTE.cream,
      radius: 10,
    });
    this.add
      .text(JUNIOR_X, CAREER_CENTER_Y - 15, "주니어 개발자", {
        ...pixelText("body"),
        color: PALETTE_HEX.ink,
      })
      .setOrigin(0.5);
    this.add
      .text(JUNIOR_X, CAREER_CENTER_Y + 8, "공통 기술 과정", {
        ...pixelText("caption"),
        color: PALETTE_HEX.mutedBrown,
      })
      .setOrigin(0.5);
    this.add
      .text(
        JUNIOR_X,
        CAREER_CENTER_Y + 28,
        this.commonPathComplete ? "CLEAR" : this.selectedJobId === "junior" ? "현재" : "진행 중",
        {
          ...pixelText("caption"),
          color: this.commonPathComplete ? PALETTE_HEX.maroon : PALETTE_HEX.mutedBrown,
        }
      )
      .setOrigin(0.5);

    if (this.commonPathComplete) frame.setAlpha(0.92);
  }

  private drawPrimaryJob(job: JobOption, y: number, selected: boolean, locked: boolean) {
    const frame = drawOrnateFrame(this, PRIMARY_X, y, PRIMARY_WIDTH, 62, {
      fill: selected ? PALETTE.sand : PALETTE.cream,
      radius: 10,
    }).setAlpha(locked ? 0.5 : 1);
    this.add.image(PRIMARY_X - 108, y, job.textureKey!).setDisplaySize(54, 54).setAlpha(locked ? 0.35 : 1);
    const name = this.add
      .text(PRIMARY_X - 70, y - 11, job.name, {
        ...pixelText("body"),
        color: PALETTE_HEX.ink,
      })
      .setOrigin(0, 0.5)
      .setAlpha(locked ? 0.45 : 1);
    fitTextInside(name, 150, 18);
    this.add
      .text(PRIMARY_X - 70, y + 12, job.tagline, {
        ...pixelText("caption"),
        color: PALETTE_HEX.mutedBrown,
      })
      .setOrigin(0, 0.5)
      .setAlpha(locked ? 0.45 : 1);
    if (selected) {
      this.add
        .text(PRIMARY_X + 111, y, "현재", {
          ...pixelText("caption"),
          color: PALETTE_HEX.maroon,
        })
        .setOrigin(0.5);
    } else if (locked) {
      this.add
        .text(PRIMARY_X + 111, y, "잠금", {
          ...pixelText("caption"),
          color: PALETTE_HEX.mutedBrown,
        })
        .setOrigin(0.5);
    }

    const hitArea = this.add
      .rectangle(PRIMARY_X, y, PRIMARY_WIDTH, 62, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => frame.setAlpha(0.82));
    hitArea.on("pointerout", () => frame.setAlpha(1));
    hitArea.on("pointerup", () => this.selectJob(job.id));
  }

  private drawSecondaryJob(job: SecondaryJobOption, index: number, y: number) {
    const unlocked = isSecondaryJobUnlocked(job, this.completedJobIds);
    const selected = this.selectedSecondaryJobId === job.id;
    const frame = drawOrnateFrame(this, SECONDARY_X, y, SECONDARY_WIDTH, 52, {
      fill: selected ? PALETTE.sand : unlocked ? PALETTE.cream : PALETTE.wood,
      fillAlpha: 0.94,
      radius: 9,
    });
    this.add
      .text(SECONDARY_X - 82, y, `Ⅱ-${index + 1}`, {
        ...pixelText("caption"),
        color: unlocked ? PALETTE_HEX.maroon : PALETTE_HEX.sand,
      })
      .setOrigin(0, 0.5);
    const name = this.add
      .text(SECONDARY_X + 12, y, unlocked ? job.name : "◆  ???", {
        ...pixelText(unlocked ? "body" : "subtitle"),
        color: unlocked ? PALETTE_HEX.ink : PALETTE_HEX.cream,
        align: "center",
        wordWrap: { width: SECONDARY_WIDTH - 72 },
      })
      .setOrigin(0.5);
    fitTextInside(name, SECONDARY_WIDTH - 72, 32);

    if (selected) {
      this.add
        .text(SECONDARY_X + 88, y - 17, "현재", {
          ...pixelText("caption"),
          color: PALETTE_HEX.maroon,
        })
        .setOrigin(0.5);
    }

    const hitArea = this.add
      .rectangle(SECONDARY_X, y, SECONDARY_WIDTH, 52, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => frame.setAlpha(0.78));
    hitArea.on("pointerout", () => frame.setAlpha(1));
    hitArea.on("pointerup", () => this.selectSecondaryJob(job));
  }

  private selectSecondaryJob(job: SecondaryJobOption) {
    if (!isSecondaryJobUnlocked(job, this.completedJobIds)) {
      const requirements = job.requires.map((jobId) => findJob(jobId).name).join(" + ");
      this.toast = showToast(this, `${requirements} 경로를 모두 완료하면 열려요.`, this.toast);
      return;
    }

    this.registry.set(SECONDARY_JOB_REGISTRY_KEY, job.id);
    const selectedPrimary =
      this.selectedJobId !== "junior" && job.requires.includes(this.selectedJobId)
        ? this.selectedJobId
        : job.requires[0];
    this.scene.start("path-map", {
      careerId: selectedPrimary,
    });
  }

  private selectJob(jobId: string) {
    const requestedJobId = jobId as JobId;
    // Before Git and Linux are cleared, choosing a card only previews its path.
    if (!this.commonPathComplete) {
      this.scene.start("path-map", { careerId: requestedJobId });
      return;
    }

    if (!canSelectPrimaryJob(this.selectedJobId, requestedJobId, this.selectedPathComplete)) {
      const currentJob = findJob(this.selectedJobId);
      this.toast = showToast(
        this,
        `${currentJob.name}의 모든 챕터를 완료하면 다른 1차 전직을 선택할 수 있어요.`,
        this.toast
      );
      return;
    }

    this.registry.set(JOB_REGISTRY_KEY, requestedJobId);
    this.scene.start("path-map", { careerId: requestedJobId });
  }
}
