import type Phaser from "phaser";
import { PALETTE } from "../palette";
import {
  BRANCH_X,
  CAREER_NODES,
  CAREER_WIDTH,
  COMMON_NODES,
  COMMON_WIDTH,
  PROMOTION_NODE,
  PROMOTION_SIZE,
  type PathNode,
} from "./layout";

type Point = [number, number];

/**
 * Draws the path lines between nodes. Endpoints come from the node geometry
 * rather than hardcoded pixels, so resizing a card can't strand a line; a
 * segment lights up once the node it leaves has been cleared.
 */
export function drawConnections(
  scene: Phaser.Scene,
  isCleared: (node: PathNode) => boolean,
  careerNodes: readonly PathNode[] = CAREER_NODES
) {
  const lines = scene.add.graphics();
  const drawPath = (points: Point[], active: boolean) => {
    lines.lineStyle(6, PALETTE.ink, 1);
    strokeThrough(lines, points);
    lines.lineStyle(2, active ? PALETTE.amber : PALETTE.mutedBrown, active ? 0.95 : 0.62);
    strokeThrough(lines, points);
  };

  const [git, terminal] = COMMON_NODES;
  const commonHalf = COMMON_WIDTH / 2;
  drawPath([[git.x + commonHalf, git.y], [terminal.x - commonHalf, terminal.y]], isCleared(git));
  drawPath(
    [
      [terminal.x + commonHalf, terminal.y],
      [PROMOTION_NODE.x - PROMOTION_SIZE / 2, PROMOTION_NODE.y],
    ],
    isCleared(terminal)
  );

  drawPath(
    [
      [PROMOTION_NODE.x + PROMOTION_SIZE / 2, PROMOTION_NODE.y],
      [BRANCH_X, PROMOTION_NODE.y],
    ],
    false
  );
  const firstCareer = careerNodes[0];
  const lastCareer = careerNodes[careerNodes.length - 1];
  const branchTop = Math.min(PROMOTION_NODE.y, firstCareer.y);
  const branchBottom = Math.max(PROMOTION_NODE.y, lastCareer.y);
  if (branchTop !== branchBottom) {
    lines.lineStyle(6, PALETTE.ink, 1);
    lines.lineBetween(BRANCH_X, branchTop, BRANCH_X, branchBottom);
    lines.lineStyle(2, PALETTE.mutedBrown, 0.62);
    lines.lineBetween(BRANCH_X, branchTop, BRANCH_X, branchBottom);
  }

  careerNodes.forEach((node) => {
    drawPath([[BRANCH_X, node.y], [node.x - CAREER_WIDTH / 2, node.y]], false);
    lines.fillStyle(PALETTE.amber, 0.8);
    lines.fillRect(BRANCH_X - 3, node.y - 3, 6, 6);
  });
}

function strokeThrough(lines: Phaser.GameObjects.Graphics, points: Point[]) {
  lines.beginPath();
  lines.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => lines.lineTo(x, y));
  lines.strokePath();
}
