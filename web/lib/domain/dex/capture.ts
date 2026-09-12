import type { CapturedCard, MonsterDefinition } from "../chapters/types";

export interface DexState {
  cards: CapturedCard[];
}

export const EMPTY_DEX_STATE: DexState = {
  cards: [],
};

/** Percentage of a battle's questions that must land to capture the monster. */
export const CAPTURE_PASS_PERCENT = 60;

/** Correct answers needed out of `total`, rounded up: Lv.1's 3 questions need 2, Lv.5's 7 need 5. */
export function requiredCorrectAnswers(total: number): number {
  return Math.ceil((total * CAPTURE_PASS_PERCENT) / 100);
}

export function isSuccessfulCapture(correct: number, total: number): boolean {
  return total > 0 && correct >= requiredCorrectAnswers(total);
}

/** Keep asking questions only while the pass line is still unmet and questions remain. */
export function shouldContinueBattle(correct: number, answered: number, total: number): boolean {
  return answered < total && !isSuccessfulCapture(correct, total);
}

export function capturedIds(state: DexState): Set<string> {
  return new Set(state.cards.map((card) => card.id));
}

/**
 * Registers `monster` in the dex. Capturing a monster that is already there
 * returns the same state object, so callers can tell a first capture from a
 * replay by identity.
 */
export function applyCapture(
  state: DexState,
  monster: MonsterDefinition,
  now: () => string = () => new Date().toISOString()
): DexState {
  if (state.cards.some((card) => card.id === monster.id)) {
    return state;
  }

  return {
    cards: [
      ...state.cards,
      {
        id: monster.id,
        dexNumber: monster.dexNumber,
        name: monster.name,
        classification: monster.classification,
        trait: monster.trait,
        description: monster.description,
        snippet: monster.snippet,
        capturedAt: now(),
      },
    ],
  };
}
