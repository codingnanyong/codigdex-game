import Phaser from "phaser";
import {
  chapterStatus,
  chapterTitle,
  getChapter,
  isCommonPathComplete,
  type ChapterStatus,
} from "@/lib/domain/chapters";
import { GIT_CHAPTER } from "@/lib/domain/chapters/git";
import { LINUX_CHAPTER } from "@/lib/domain/chapters/linux";
import type { ChapterId } from "@/lib/domain/chapters/types";
import { capturedIds } from "@/lib/domain/dex/capture";
import {
  completedSecondaryJobIds,
  findJob,
  findSecondaryJob,
  findTertiaryJob,
  isSecondaryJobUnlocked,
  isTertiaryJobUnlocked,
  JOB_REGISTRY_KEY,
  SECONDARY_JOB_REGISTRY_KEY,
  secondaryJobsFor,
  TERTIARY_JOB_REGISTRY_KEY,
  tertiaryJobsFor,
  type JobId,
  type SecondaryJobOption,
  type SecondaryJobId,
  type TertiaryJobOption,
} from "@/lib/domain/player/jobs";
import { COMMON_TECHNOLOGY_SPECIMENS } from "@/lib/domain/technologySpecimens";
import { preloadMonsterArt } from "../monsterArt";
import { PALETTE } from "../palette";
import { drawConnections } from "../pathMap/connections";
import { CAREER_NODES, CAREER_PORTRAITS, COMMON_NODES, PROMOTION_NODE, type PathNode } from "../pathMap/layout";
import { drawPathNode, drawPromotionNode, drawSecondaryCareerNode } from "../pathMap/nodes";
import { StagePanel } from "../pathMap/stagePanel";
import { drawHeader, drawMapSurface, drawSectionLabels } from "../pathMap/surface";
import { readDexState } from "../registryAdapter";
import { applyPixelFontToScene, createButton, showToast } from "../ui";
import { completedCareerPathIds } from "../worldMap/careerPaths";

export interface PathMapData {
  /** Opens this chapter's stage panel on arrival, to carry on after a battle. */
  focusChapterId?: ChapterId;
  /** Career chosen immediately before opening this route. */
  careerId?: JobId;
}

/** The junior path: common chapters, the promotion diamond, and the career branches. */
export class PathMapScene extends Phaser.Scene {
  private captured: ReadonlySet<string> = new Set();
  private focusChapterId?: ChapterId;
  private selectedCareerId?: JobId;
  private toast?: Phaser.GameObjects.Text;
  private stagePanel?: StagePanel;
  private completedCareerIds: ReadonlySet<JobId> = new Set();
  private completedSecondaryIds: ReadonlySet<SecondaryJobId> = new Set();
  private selectedSecondaryJobId?: string;
  private selectedTertiaryJobId?: string;

  constructor() {
    super("path-map");
  }

  init(data?: PathMapData) {
    this.focusChapterId = data?.focusChapterId;
    const requested = data?.careerId ?? (this.registry.get(JOB_REGISTRY_KEY) as string | undefined);
    const job = findJob(requested);
    this.selectedCareerId = job.id === "junior" ? undefined : (job.id as JobId);
  }

  preload() {
    COMMON_TECHNOLOGY_SPECIMENS.forEach(({ textureKey, assetPath }) => this.load.image(textureKey, assetPath));
    CAREER_PORTRAITS.forEach(({ textureKey, assetPath }) => this.load.image(textureKey, assetPath));
    preloadMonsterArt(this, [...GIT_CHAPTER.stages, ...LINUX_CHAPTER.stages]);
  }

  create() {
    const { width, height } = this.scale;
    // Scene instances outlive restarts, so drop references to the last run's objects.
    this.toast = undefined;
    this.stagePanel = undefined;
    this.captured = capturedIds(readDexState(this.registry));
    this.completedCareerIds = completedCareerPathIds(this.captured);
    this.completedSecondaryIds = completedSecondaryJobIds(this.captured);
    const storedSecondaryJob = findSecondaryJob(
      this.registry.get(SECONDARY_JOB_REGISTRY_KEY) as string | null | undefined
    );
    this.selectedSecondaryJobId =
      storedSecondaryJob && isSecondaryJobUnlocked(storedSecondaryJob, this.completedCareerIds)
        ? storedSecondaryJob.id
        : undefined;
    const storedTertiaryJob = findTertiaryJob(
      this.registry.get(TERTIARY_JOB_REGISTRY_KEY) as string | null | undefined
    );
    this.selectedTertiaryJobId =
      storedTertiaryJob && isTertiaryJobUnlocked(storedTertiaryJob, this.completedSecondaryIds)
        ? storedTertiaryJob.id
        : undefined;

    const selectedCareer = CAREER_NODES.find((node) => node.id === this.selectedCareerId);
    const careerNodes = selectedCareer ? [{ ...selectedCareer, y: 180 }] : CAREER_NODES;
    const nodes = [...COMMON_NODES, PROMOTION_NODE, ...careerNodes];
    const selectedJob = findJob(this.selectedCareerId);

    drawMapSurface(this);
    const selectedSecondary = findSecondaryJob(this.selectedSecondaryJobId);
    const secondaryOnThisPath =
      selectedSecondary && this.selectedCareerId && selectedSecondary.requires.includes(this.selectedCareerId)
        ? selectedSecondary
        : undefined;
    const selectedTertiary = findTertiaryJob(this.selectedTertiaryJobId);
    const tertiaryOnThisPath =
      selectedTertiary && secondaryOnThisPath && selectedTertiary.requires === secondaryOnThisPath.id
        ? selectedTertiary
        : undefined;
    drawHeader(
      this,
      selectedCareer ? selectedJob.name : undefined,
      secondaryOnThisPath?.name,
      tertiaryOnThisPath?.name
    );
    drawSectionLabels(this);
    drawConnections(this, (node) => this.statusOf(node) === "cleared", careerNodes);

    for (const node of nodes) {
      const onSelect = () => this.onNodeSelected(node);
      if (node.kind === "promotion") {
        drawPromotionNode(this, node, { lit: isCommonPathComplete(this.captured), onSelect });
      } else {
        drawPathNode(this, node, { status: this.statusOf(node), eyebrow: this.eyebrowFor(node), onSelect });
      }
    }

    if (this.selectedCareerId) this.drawAdvancedCareerPaths(this.selectedCareerId);

    createButton(this, width / 2, height - 27, 140, 32, "돌아가기", () => this.scene.start("world-map"));
    createButton(this, 92, height - 27, 140, 32, "직업 변경", () => this.scene.start("job-select"));
    if (this.captured.size > 0) {
      createButton(this, width - 92, 47, 120, 32, "Codigdex 도감", () => this.openCodigdex());
    }

    applyPixelFontToScene(this);
    this.openFocusedChapter();
  }

  private drawAdvancedCareerPaths(careerId: JobId) {
    const candidates = secondaryJobsFor(careerId);
    const centerX = 790;
    const secondaryY = 315;
    const tertiaryY = 430;
    const spacing = 115;
    const startX = centerX - ((candidates.length - 1) * spacing) / 2;
    const primaryX = CAREER_NODES.find((node) => node.id === careerId)!.x;
    const primaryBottom = 207;
    const branchY = 250;

    const lines = this.add.graphics();
    lines.lineStyle(5, PALETTE.ink, 0.8);
    lines.lineBetween(primaryX, primaryBottom, primaryX, branchY);
    lines.lineStyle(2, PALETTE.mutedBrown, 0.75);
    lines.lineBetween(primaryX, primaryBottom, primaryX, branchY);

    candidates.forEach((candidate, index) => {
      const x = startX + index * spacing;
      lines.lineStyle(5, PALETTE.ink, 0.8);
      lines.lineBetween(primaryX, branchY, x, secondaryY - 27);
      lines.lineStyle(2, PALETTE.mutedBrown, 0.75);
      lines.lineBetween(primaryX, branchY, x, secondaryY - 27);
      const unlocked = isSecondaryJobUnlocked(candidate, this.completedCareerIds);
      drawSecondaryCareerNode(this, x, secondaryY, {
        name: candidate.name,
        unlocked,
        selected: this.selectedSecondaryJobId === candidate.id,
        onSelect: () => this.onSecondaryCareerSelected(candidate),
      });
    });

    const selectedSecondaryIndex = candidates.findIndex(
      (candidate) => candidate.id === this.selectedSecondaryJobId
    );
    const selectedSecondary = candidates[selectedSecondaryIndex];
    const tertiary = selectedSecondary && tertiaryJobsFor(selectedSecondary.id)[0];
    const tertiaryX = selectedSecondary ? startX + selectedSecondaryIndex * spacing : centerX;
    const tertiaryTop = tertiaryY - 27;
    const secondaryBottom = secondaryY + 27;

    lines.lineStyle(5, PALETTE.ink, 0.8);
    lines.lineBetween(tertiaryX, secondaryBottom, tertiaryX, tertiaryTop);
    lines.lineStyle(2, PALETTE.mutedBrown, 0.75);
    lines.lineBetween(tertiaryX, secondaryBottom, tertiaryX, tertiaryTop);

    drawSecondaryCareerNode(this, tertiaryX, tertiaryY, {
      name: tertiary?.name ?? "",
      unlocked: tertiary ? isTertiaryJobUnlocked(tertiary, this.completedSecondaryIds) : false,
      selected: tertiary?.id === this.selectedTertiaryJobId,
      tierLabel: "3차 전직",
      onSelect: () => {
        if (tertiary) this.onTertiaryCareerSelected(tertiary);
        else this.notify("2차 직업을 선택하고 마스터 경로를 완료하면 3차 전직이 열려요.");
      },
    });
  }

  private onSecondaryCareerSelected(job: SecondaryJobOption) {
    if (!isSecondaryJobUnlocked(job, this.completedCareerIds)) {
      const requirements = job.requires.map((jobId) => findJob(jobId).name).join(" + ");
      this.notify(`${requirements} 경로를 모두 완료하면 열려요.`);
      return;
    }

    this.registry.set(SECONDARY_JOB_REGISTRY_KEY, job.id);
    this.scene.restart({ careerId: this.selectedCareerId });
  }

  private onTertiaryCareerSelected(job: TertiaryJobOption) {
    if (!isTertiaryJobUnlocked(job, this.completedSecondaryIds)) {
      const required = findSecondaryJob(job.requires);
      this.notify(`${required?.name ?? "2차 직업"} 마스터 경로를 완료하면 열려요.`);
      return;
    }

    this.registry.set(TERTIARY_JOB_REGISTRY_KEY, job.id);
    this.scene.restart({ careerId: this.selectedCareerId });
  }

  private statusOf(node: PathNode): ChapterStatus {
    if (node.chapterId) return chapterStatus(getChapter(node.chapterId), this.captured);
    if (node.kind === "career" && node.id === this.selectedCareerId && isCommonPathComplete(this.captured)) {
      return "available";
    }
    return "locked";
  }

  /** "CH.01", then "CH.01 · 2/5" part-way through a multi-stage chapter, then "CH.01 · CLEAR". */
  private eyebrowFor(node: PathNode): string {
    if (!node.chapterId) return node.eyebrow;
    const status = this.statusOf(node);
    if (status === "cleared") return `${node.eyebrow} · CLEAR`;

    const { stages } = getChapter(node.chapterId);
    if (status === "available" && stages.length > 1) {
      const captured = stages.filter((stage) => this.captured.has(stage.id)).length;
      return `${node.eyebrow} · ${captured}/${stages.length}`;
    }
    return node.eyebrow;
  }

  private openFocusedChapter() {
    const node = COMMON_NODES.find((candidate) => candidate.chapterId === this.focusChapterId);
    if (node?.chapterId && this.statusOf(node) !== "locked") {
      const chapterId = node.chapterId;
      this.time.delayedCall(250, () => this.openStagePanel(chapterId));
    }
  }

  private onNodeSelected(node: PathNode) {
    if (node.chapterId) {
      if (this.statusOf(node) === "locked") {
        const chapter = getChapter(node.chapterId);
        const required = chapter.requires && getChapter(chapter.requires);
        this.notify(required ? `${chapterTitle(required)} 클리어 후 열려요.` : `${chapter.name} 챕터는 아직 잠겨 있어요.`);
        return;
      }
      this.openStagePanel(node.chapterId);
    } else if (node.kind === "promotion") {
      this.scene.start("job-select");
    } else {
      if (isCommonPathComplete(this.captured) && node.id === this.selectedCareerId) {
        this.scene.start("world-map");
      } else {
        this.notify(`${node.label} 전직에는 Git과 Linux 클리어가 필요해요.`);
      }
    }
  }

  private openStagePanel(chapterId: ChapterId) {
    if (this.stagePanel) return;
    this.stagePanel = new StagePanel(this, getChapter(chapterId), this.captured, {
      onStart: (monsterId) => this.scene.start("code-battle", { monsterId }),
      onClose: () => {
        this.stagePanel?.destroy();
        this.stagePanel = undefined;
      },
    });
  }

  private notify(message: string) {
    this.toast = showToast(this, message, this.toast);
  }

  private openCodigdex() {
    this.scene.launch("codigdex", { returnTo: this.scene.key });
    this.scene.pause();
  }
}
