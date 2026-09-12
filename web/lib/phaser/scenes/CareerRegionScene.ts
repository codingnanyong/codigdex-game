import Phaser from "phaser";
import { findJob, type JobId } from "@/lib/domain/player/jobs";
import { PALETTE, PALETTE_HEX } from "../palette";
import { pixelText } from "../pixelFont";
import { applyPixelFontToScene, createButton, drawOrnateFrame, fitTextInside } from "../ui";
import { careerPathFor, type CareerRegion } from "../worldMap/careerPaths";

interface CareerRegionData {
  careerId: JobId;
  regionId: string;
}

/** A zoomed-in destination between the career atlas and a future chapter battle. */
export class CareerRegionScene extends Phaser.Scene {
  private careerId: JobId = "frontend";
  private regionId = "html-css";

  constructor() {
    super("career-region");
  }

  init(data?: CareerRegionData) {
    if (data?.careerId) this.careerId = data.careerId;
    if (data?.regionId) this.regionId = data.regionId;
  }

  preload() {
    const path = careerPathFor(this.careerId);
    const job = findJob(this.careerId);
    this.load.image(path.textureKey, path.assetPath);
    this.load.image(job.textureKey!, job.assetPath!);
  }

  create() {
    const { width, height } = this.scale;
    const path = careerPathFor(this.careerId);
    const job = findJob(this.careerId);
    const region = path.regions.find((candidate) => candidate.id === this.regionId) ?? path.regions[0];
    const zoom = 1.42;

    // Pull the selected pad toward the center without exposing empty canvas at map edges.
    const scaledWidth = width * zoom;
    const scaledHeight = height * zoom;
    const backdropX = Phaser.Math.Clamp(
      width / 2 + (width / 2 - region.landmark.x) * zoom,
      width - scaledWidth / 2,
      scaledWidth / 2
    );
    const backdropY = Phaser.Math.Clamp(
      height / 2 + (height / 2 - region.landmark.y) * zoom,
      height - scaledHeight / 2,
      scaledHeight / 2
    );
    this.add.image(backdropX, backdropY, path.textureKey).setDisplaySize(width * zoom, height * zoom);
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.nightBrown, 0.2);

    drawOrnateFrame(this, width / 2, 48, 430, 66, { fillAlpha: 0.96, radius: 12 });
    this.add
      .text(width / 2, 35, `${region.label} · 상세 지역`, {
        ...pixelText("subtitle"),
        color: PALETTE_HEX.maroon,
      })
      .setOrigin(0.5);
    const careerTitle = this.add
      .text(width / 2, 60, `${job.name} 도감 수집지`, {
        ...pixelText("caption"),
        color: PALETTE_HEX.mutedBrown,
      })
      .setOrigin(0.5);
    fitTextInside(careerTitle, 390, 16);

    this.drawGuide(job.textureKey!, job.guideName, region);
    createButton(this, 88, height - 28, 136, 34, "상세 지도", () => this.scene.start("world-map"));
    createButton(this, width - 88, height - 28, 136, 34, "Path 보기", () =>
      this.scene.start("path-map", { careerId: this.careerId })
    );
    applyPixelFontToScene(this);
  }

  private drawGuide(textureKey: string, guideName: string, region: CareerRegion) {
    const { width, height } = this.scale;
    drawOrnateFrame(this, width / 2, height - 112, 590, 118, { fillAlpha: 0.96, radius: 14 });
    this.add.image(width / 2 - 230, height - 112, textureKey).setDisplaySize(102, 102);
    this.add.text(width / 2 - 165, height - 148, guideName, {
      ...pixelText("body"),
      color: PALETTE_HEX.maroon,
    });
    this.add.text(
      width / 2 - 165,
      height - 120,
      `${region.label} 몬스터의 도감·배틀·퀴즈 콘텐츠를 연결 중이에요.\n지역 입구와 돌아가는 길은 먼저 열어 두었어요.`,
      {
        ...pixelText("body"),
        color: PALETTE_HEX.ink,
        lineSpacing: 5,
      }
    );
  }
}
