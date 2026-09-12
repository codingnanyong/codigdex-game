import Phaser from "phaser";
import { findStage } from "@/lib/domain/chapters";
import type { ChapterDefinition, MonsterDefinition, QuizQuestion } from "@/lib/domain/chapters/types";
import {
  isSuccessfulCapture,
  requiredCorrectAnswers,
  shouldContinueBattle,
} from "@/lib/domain/dex/capture";
import { drawQuizQuestions, quizCountForLevel } from "@/lib/domain/dex/quiz";
import { playAmbience } from "../ambience";
import { AnswerGrid } from "../battle/answerGrid";
import { drawNpcBanner } from "../battle/banner";
import { MessagePanel } from "../battle/messagePanel";
import { Opponent } from "../battle/opponent";
import { StatusPanel } from "../battle/statusPanel";
import { preloadMonsterArt } from "../monsterArt";
import { applyPixelFontToScene } from "../ui";

export interface CodeBattleData {
  monsterId: string;
}

/** Runs one battle until its pass line is reached or its questions run out. */
export class CodeBattleScene extends Phaser.Scene {
  private chapter!: ChapterDefinition;
  private monster!: MonsterDefinition;
  private questions: QuizQuestion[] = [];
  private questionIndex = 0;
  private correctCount = 0;
  private locked = false;
  private status!: StatusPanel;
  private opponent!: Opponent;
  private message!: MessagePanel;
  private answers!: AnswerGrid;

  constructor() {
    super("code-battle");
  }

  init(data: CodeBattleData) {
    const { chapter, monster } = findStage(data.monsterId);
    this.chapter = chapter;
    this.monster = monster;
    this.questions = drawQuizQuestions(monster.quizPool, quizCountForLevel(monster.level));
    this.questionIndex = 0;
    this.correctCount = 0;
    this.locked = false;
  }

  preload() {
    preloadMonsterArt(this, [this.monster]);
    const { arena } = this.chapter;
    if (arena) this.load.image(arena.textureKey, arena.assetPath);
  }

  create() {
    const { width, height } = this.scale;
    const { arena, npcName } = this.chapter;

    // Backdrop and its ambience go in first so every battle panel draws on top.
    if (arena) {
      this.add.image(width / 2, height / 2, arena.textureKey).setDisplaySize(width, height);
      playAmbience(this, arena.ambience);
    }

    drawNpcBanner(this, `${npcName}: ${this.monster.preBattleLine}`);
    this.status = new StatusPanel(this, this.monster);
    this.opponent = new Opponent(this, this.monster);
    this.message = new MessagePanel(this);
    this.answers = new AnswerGrid(this);

    this.showQuestion();
    applyPixelFontToScene(this);
  }

  private showQuestion() {
    const question = this.questions[this.questionIndex];
    this.message.showQuestion({
      index: this.questionIndex,
      total: this.questions.length,
      correct: this.correctCount,
      required: requiredCorrectAnswers(this.questions.length),
      prompt: question.prompt,
    });
    this.answers.show(question.choices, (index) => this.onAnswer(index, index === question.answerIndex));
  }

  private onAnswer(index: number, isCorrect: boolean) {
    if (this.locked) return;
    this.locked = true;
    this.answers.mark(index, isCorrect);

    if (isCorrect) {
      this.correctCount += 1;
      this.message.say("명중! 타격을 줬어요.");
      const required = requiredCorrectAnswers(this.questions.length);
      this.status.setHealth(Math.max(0, required - this.correctCount) / required);
      this.opponent.flinch();
    } else {
      this.message.say("안 통했어요!");
    }

    this.time.delayedCall(650, () => {
      this.locked = false;
      this.advance();
    });
  }

  private advance() {
    this.questionIndex += 1;
    if (shouldContinueBattle(this.correctCount, this.questionIndex, this.questions.length)) {
      this.showQuestion();
      return;
    }

    this.answers.clear();
    if (isSuccessfulCapture(this.correctCount, this.questions.length)) {
      this.message.say(`${this.monster.name} 격파!`);
      this.opponent.faint(() => this.finishBattle());
    } else {
      this.message.say("전투 종료! 결과를 확인할게요.");
      this.time.delayedCall(700, () => this.finishBattle());
    }
  }

  private finishBattle() {
    this.scene.start("capture-quiz", {
      monsterId: this.monster.id,
      correctCount: this.correctCount,
      total: this.questions.length,
    });
  }
}
