import Phaser from "phaser";
import { PALETTE, PALETTE_HEX } from "./palette";
import { pixelText, whenPixelFontReady } from "./pixelFont";

/**
 * Re-rasterizes every Text object already in a scene once the webfont has
 * actually loaded — text drawn before that point bakes the fallback face
 * into its texture and never refreshes on its own. Setting each object's
 * own family back on itself is just the public way to make Phaser redraw
 * that texture; the family string itself doesn't change.
 */
export function applyPixelFontToScene(scene: Phaser.Scene) {
  whenPixelFontReady(() => {
    const restyle = (child: Phaser.GameObjects.GameObject) => {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setFontFamily(child.style.fontFamily);
      } else if (child instanceof Phaser.GameObjects.Container) {
        child.list.forEach(restyle);
      }
    };
    scene.children.list.forEach(restyle);
  });
}

/** Keeps dynamic copy inside a fixed UI plate, including after the pixel font finishes loading. */
export function fitTextInside(
  text: Phaser.GameObjects.Text,
  maxWidth: number,
  maxHeight: number
): Phaser.GameObjects.Text {
  const fit = () => {
    if (!text.scene) return;
    text.setScale(1);
    const widthScale = text.width > 0 ? maxWidth / text.width : 1;
    const heightScale = text.height > 0 ? maxHeight / text.height : 1;
    text.setScale(Math.min(1, widthScale, heightScale));
  };
  fit();
  whenPixelFontReady(fit);
  return text;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  options: { fontSize?: string; fontFamily?: string } = {}
): Phaser.GameObjects.Container {
  const bg = scene.add
    .rectangle(0, 0, width, height, PALETTE.wood, 1)
    .setStrokeStyle(2, PALETTE.ink)
    .setInteractive({ useHandCursor: true });

  const body = pixelText("body");
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: options.fontFamily ?? body.fontFamily,
      fontSize: options.fontSize ?? body.fontSize,
      color: PALETTE_HEX.cream,
      align: "center",
    })
    .setOrigin(0.5);
  fitTextInside(text, width - 16, height - 10);

  const container = scene.add.container(x, y, [bg, text]);

  bg.on("pointerover", () => bg.setFillStyle(PALETTE.maroon));
  bg.on("pointerout", () => bg.setFillStyle(PALETTE.wood));
  bg.on("pointerdown", () => bg.setFillStyle(PALETTE.amber));
  bg.on("pointerup", () => {
    bg.setFillStyle(PALETTE.maroon);
    onClick();
  });

  return container;
}

/** Turns a createButton button on or off, dimming it while it's off. */
export function setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean) {
  const bg = button.list[0] as Phaser.GameObjects.Rectangle;
  if (enabled) {
    bg.setInteractive({ useHandCursor: true });
  } else {
    bg.disableInteractive();
  }
  button.setAlpha(enabled ? 1 : 0.45);
}

/**
 * Rounded parchment panel with a double border and corner rivets — the
 * shared frame language for the Codigdex and capture-quiz panels.
 */
export function drawOrnateFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: number; fillAlpha?: number; radius?: number } = {}
): Phaser.GameObjects.Graphics {
  const radius = options.radius ?? 14;
  const fill = options.fill ?? PALETTE.cream;
  const fillAlpha = options.fillAlpha ?? 0.98;
  const left = x - width / 2;
  const top = y - height / 2;

  const g = scene.add.graphics();

  g.fillStyle(PALETTE.nightBrown, 0.35);
  g.fillRoundedRect(left + 4, top + 6, width, height, radius);

  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(left, top, width, height, radius);
  g.lineStyle(3, PALETTE.ink, 1);
  g.strokeRoundedRect(left, top, width, height, radius);
  g.lineStyle(1, PALETTE.amber, 0.85);
  g.strokeRoundedRect(left + 7, top + 7, width - 14, height - 14, Math.max(radius - 5, 2));

  g.fillStyle(PALETTE.amber, 1);
  [
    [left + 12, top + 12],
    [left + width - 12, top + 12],
    [left + 12, top + height - 12],
    [left + width - 12, top + height - 12],
  ].forEach(([cx, cy]) => g.fillCircle(cx, cy, 3.5));

  return g;
}

/** Full-screen dimmer behind a modal. It's interactive, so clicks can't reach the scene below. */
export function addShade(scene: Phaser.Scene, alpha: number, depth = 0): Phaser.GameObjects.Rectangle {
  const { width, height } = scene.scale;
  return scene.add
    .rectangle(width / 2, height / 2, width, height, PALETTE.nightBrown, alpha)
    .setInteractive()
    .setDepth(depth);
}

/** Scales a freshly built modal up into place. */
export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Container, fromScale = 0.9) {
  target.setAlpha(0).setScale(fromScale);
  scene.tweens.add({
    targets: target,
    alpha: 1,
    scale: 1,
    duration: 240,
    ease: "Back.Out",
  });
}

/**
 * A code sample on a dark plate, centered on x = 0 with its top edge at `y`.
 * Snippets run one to three lines, so the plate is sized to the text. Add the
 * plate to a container before the text so it renders underneath.
 */
export function addSnippetBlock(
  scene: Phaser.Scene,
  y: number,
  width: number,
  snippet: string,
  options: { align?: "center" | "left" } = {}
) {
  const text = scene.add
    .text(0, y + 8, snippet, {
      ...pixelText("body"),
      color: PALETTE_HEX.sand,
      // "left" keeps code indentation readable while the block stays centered.
      align: options.align ?? "center",
    })
    .setOrigin(0.5, 0);
  const height = text.height + 16;
  const plate = scene.add
    .rectangle(0, y, width, height, PALETTE.nightBrown, 0.9)
    .setStrokeStyle(2, PALETTE.ink)
    .setOrigin(0.5, 0);
  return { plate, text, height };
}

/** A short message along the bottom that fades away, replacing `previous` if it's still up. */
export function showToast(
  scene: Phaser.Scene,
  message: string,
  previous?: Phaser.GameObjects.Text
): Phaser.GameObjects.Text {
  previous?.destroy();
  const { width, height } = scene.scale;
  const toast = scene.add
    .text(width / 2, height - 65, message, {
      ...pixelText("body"),
      color: PALETTE_HEX.cream,
      backgroundColor: "#2a1d14f2",
      padding: { x: 12, y: 7 },
    })
    .setOrigin(0.5)
    .setDepth(10);

  scene.tweens.add({
    targets: toast,
    alpha: { from: 1, to: 0 },
    delay: 1_400,
    duration: 400,
    onComplete: () => toast.destroy(),
  });
  return toast;
}
