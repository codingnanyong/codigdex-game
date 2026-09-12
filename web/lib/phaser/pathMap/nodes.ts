import Phaser from "phaser";
import type { ChapterStatus } from "@/lib/domain/chapters";
import { PALETTE, PALETTE_HEX } from "../palette";
import { pixelText } from "../pixelFont";
import { fitTextInside } from "../ui";
import {
  CAREER_HEIGHT,
  CAREER_WIDTH,
  COMMON_HEIGHT,
  COMMON_WIDTH,
  PROMOTION_SIZE,
  SPRITE_BOX,
  SPRITE_GAP,
  type PathNode,
} from "./layout";

export interface PathNodeState {
  status: ChapterStatus;
  eyebrow: string;
  onSelect: () => void;
}

/** A chapter or career card: portrait medallion, eyebrow, label, and a lock or play glyph. */
export function drawPathNode(scene: Phaser.Scene, node: PathNode, state: PathNodeState) {
  const isCommon = node.kind === "common";
  const width = isCommon ? COMMON_WIDTH : CAREER_WIDTH;
  const height = isCommon ? COMMON_HEIGHT : CAREER_HEIGHT;
  const lit = state.status !== "locked";
  const fill = state.status === "cleared" ? PALETTE.sand : lit ? PALETTE.cream : PALETTE.wood;

  const panel = scene.add.graphics();
  panel.fillStyle(PALETTE.ink, 0.7);
  panel.fillRect(-width / 2 + 4, -height / 2 + 5, width, height);
  panel.fillStyle(fill, 1);
  panel.fillRect(-width / 2, -height / 2, width, height);
  panel.lineStyle(2, lit ? PALETTE.amber : PALETTE.mutedBrown, 1);
  panel.strokeRect(-width / 2, -height / 2, width, height);
  panel.fillStyle(lit ? PALETTE.maroon : PALETTE.nightBrown, 1);
  panel.fillRect(-width / 2, -height / 2, 6, height);

  const spriteBox = isCommon ? SPRITE_BOX.common : SPRITE_BOX.career;
  const spriteCenterX = -width / 2 + 12 + spriteBox / 2;
  const portrait = drawPortrait(scene, node.spriteKey!, spriteCenterX, spriteBox, lit);
  const textLeft = spriteCenterX + spriteBox / 2 + SPRITE_GAP;

  const eyebrow = scene.add
    .text(textLeft, -13, state.eyebrow, {
      ...pixelText("caption"),
      color: lit ? PALETTE_HEX.maroon : PALETTE_HEX.sand,
    })
    .setOrigin(0, 0.5);
  const label = scene.add
    .text(textLeft, 10, node.label, {
      ...pixelText("body"),
      color: lit ? PALETTE_HEX.ink : PALETTE_HEX.cream,
    })
    .setOrigin(0, 0.5);
  fitTextInside(label, width / 2 - textLeft - 28, height - 10);
  const glyph = scene.add
    .text(width / 2 - 16, 0, lit ? "▶" : "◆", {
      ...pixelText("caption"),
      color: lit ? PALETTE_HEX.maroon : PALETTE_HEX.mutedBrown,
    })
    .setOrigin(0.5);

  const card = scene.add.container(node.x, node.y, [panel, portrait, eyebrow, label, glyph]);
  makePressable(card, new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), 1.025, state.onSelect);
}

/** The diamond where the common path ends and a job is chosen. */
export function drawPromotionNode(
  scene: Phaser.Scene,
  node: PathNode,
  { lit, onSelect }: { lit: boolean; onSelect: () => void }
) {
  const half = PROMOTION_SIZE / 2;
  const diamond = [
    new Phaser.Math.Vector2(0, -half),
    new Phaser.Math.Vector2(half, 0),
    new Phaser.Math.Vector2(0, half),
    new Phaser.Math.Vector2(-half, 0),
  ];

  const panel = scene.add.graphics();
  panel.fillStyle(PALETTE.ink, 0.65);
  panel.fillPoints(diamond.map((point) => new Phaser.Math.Vector2(point.x + 4, point.y + 5)), true);
  panel.fillStyle(PALETTE.maroon, 1);
  panel.fillPoints(diamond, true);
  panel.lineStyle(3, PALETTE.amber, 1);
  panel.strokePoints(diamond, true);

  const ring = scene.add.circle(0, -13, 18, PALETTE.nightBrown, 1);
  ring.setStrokeStyle(2, lit ? PALETTE.amber : PALETTE.mutedBrown, 1);
  const star = scene.add
    .text(0, -13, "★", {
      ...pixelText("body"),
      color: lit ? PALETTE_HEX.amber : PALETTE_HEX.sand,
    })
    .setOrigin(0.5);
  const label = scene.add
    .text(0, 20, node.label, {
      ...pixelText("body"),
      color: PALETTE_HEX.cream,
    })
    .setOrigin(0.5);
  fitTextInside(label, PROMOTION_SIZE - 10, 22);

  const card = scene.add.container(node.x, node.y, [panel, ring, star, label]);
  makePressable(card, new Phaser.Geom.Rectangle(-half, -half, PROMOTION_SIZE, PROMOTION_SIZE), 1.04, onSelect);
}

/** A tier-two node: mystery until both required primary paths are complete. */
export function drawSecondaryCareerNode(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: {
    name: string;
    unlocked: boolean;
    selected: boolean;
    onSelect: () => void;
    tierLabel?: "2차 전직" | "3차 전직";
  }
) {
  const width = 104;
  const height = 54;
  const panel = scene.add
    .rectangle(
      0,
      0,
      width,
      height,
      options.selected ? PALETTE.sand : options.unlocked ? PALETTE.cream : PALETTE.nightBrown,
      0.96
    )
    .setStrokeStyle(2, options.unlocked ? PALETTE.amber : PALETTE.mutedBrown);
  const eyebrow = scene.add
    .text(0, -13, options.selected ? `${options.tierLabel ?? "2차 전직"} · 현재` : options.tierLabel ?? "2차 전직", {
      ...pixelText("caption"),
      color: options.unlocked ? PALETTE_HEX.maroon : PALETTE_HEX.sand,
    })
    .setOrigin(0.5);
  const label = scene.add
    .text(0, 11, options.unlocked ? options.name : "◆  ???", {
      ...pixelText("caption"),
      color: options.unlocked ? PALETTE_HEX.ink : PALETTE_HEX.cream,
      align: "center",
      wordWrap: { width: width - 10 },
    })
    .setOrigin(0.5);
  fitTextInside(label, width - 10, 22);
  const card = scene.add.container(x, y, [panel, eyebrow, label]);
  makePressable(
    card,
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    1.035,
    options.onSelect
  );
  return card;
}

/**
 * Specimen art has to be transparent to its edges for this to read as a
 * portrait in a ring rather than a square on a disc — the sprite is drawn at
 * the full box size, wider than the medallion behind it.
 */
function drawPortrait(scene: Phaser.Scene, textureKey: string, x: number, size: number, lit: boolean) {
  const medallion = scene.add.circle(x, 0, size / 2 - 2, PALETTE.nightBrown, 1);
  medallion.setStrokeStyle(2, PALETTE.amber, 0.72);
  const art = scene.add
    .image(x, 1, textureKey)
    .setDisplaySize(size, size)
    .setAlpha(lit ? 1 : 0.78);
  return scene.add.container(0, 0, [medallion, art]);
}

/**
 * A container has no size of its own, so its hit area is given explicitly,
 * centered on the card — otherwise Phaser anchors it at the top-left corner.
 */
function makePressable(
  card: Phaser.GameObjects.Container,
  hitArea: Phaser.Geom.Rectangle,
  hoverScale: number,
  onSelect: () => void
) {
  card.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
  card.input!.cursor = "pointer";
  card.on("pointerover", () => card.setScale(hoverScale));
  card.on("pointerout", () => card.setScale(1));
  card.on("pointerup", onSelect);
}
