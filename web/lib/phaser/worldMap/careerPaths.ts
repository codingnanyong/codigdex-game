import type { JobId } from "@/lib/domain/player/jobs";

export interface CareerRegion {
  id: string;
  label: string;
  /** Legacy route-disc center, retained for map composition references. */
  x: number;
  y: number;
  /** Illustrated destination bounds and its non-rectangular interactive outline. */
  landmark: { x: number; y: number; width: number; height: number };
  focusPoints: readonly Point[];
}

export interface CareerPathDefinition {
  jobId: JobId;
  textureKey: string;
  assetPath: string;
  title: string;
  regions: readonly CareerRegion[];
  /** Final captures that prove every chapter in this primary path is complete. */
  completionCaptureIds: readonly string[];
}

export type Point = readonly [x: number, y: number];

const region = (
  id: string,
  label: string,
  [x, y]: Point,
  outline: readonly Point[]
): CareerRegion => {
  const xs = outline.map(([pointX]) => pointX);
  const ys = outline.map(([, pointY]) => pointY);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const landmarkX = (left + right) / 2;
  const landmarkY = (top + bottom) / 2;
  return {
    id,
    label,
    x,
    y,
    landmark: { x: landmarkX, y: landmarkY, width: right - left, height: bottom - top },
    focusPoints: outline.map(([pointX, pointY]) => [pointX - landmarkX, pointY - landmarkY]),
  };
};

export const CAREER_PATHS: Record<JobId, CareerPathDefinition> = {
  frontend: {
    jobId: "frontend",
    textureKey: "world-career-frontend",
    assetPath: "/assets/wallpapers/career-paths/frontend-path-map-v1.png",
    title: "웹 프론트엔드 개발자 경로",
    completionCaptureIds: [],
    regions: [
      region("html-css", "HTML/CSS", [164, 384], [[18, 292], [70, 263], [151, 263], [211, 289], [253, 337], [244, 397], [190, 431], [83, 426], [22, 394]]),
      region("javascript", "JavaScript", [339, 265], [[193, 148], [227, 113], [309, 104], [371, 132], [397, 190], [381, 247], [330, 279], [250, 272], [202, 230]]),
      region("http-api", "브라우저 · HTTP", [487, 384], [[351, 311], [404, 282], [510, 282], [584, 306], [609, 357], [580, 405], [503, 428], [415, 414], [362, 373]]),
      region("react", "React", [691, 305], [[618, 165], [665, 133], [743, 135], [794, 174], [810, 238], [783, 303], [724, 335], [655, 321], [614, 267]]),
      region("frontend-testing", "프론트엔드 테스트", [839, 119], [[816, 31], [853, 8], [907, 12], [945, 48], [951, 111], [918, 166], [866, 196], [814, 170], [792, 105]]),
    ],
  },
  backend: {
    jobId: "backend",
    textureKey: "world-career-backend",
    assetPath: "/assets/wallpapers/career-paths/backend-path-map-v1.png",
    title: "백엔드 개발자 경로",
    completionCaptureIds: [],
    regions: [
      region("http-api", "HTTP/API", [109, 416], [[20, 353], [72, 324], [139, 329], [184, 365], [184, 425], [146, 468], [76, 480], [21, 449]]),
      region("server-framework", "서버 프레임워크", [262, 195], [[40, 75], [83, 45], [151, 49], [204, 82], [224, 140], [208, 199], [159, 229], [88, 218], [45, 175]]),
      region("sql", "데이터베이스 · SQL", [447, 205], [[371, 119], [402, 94], [481, 92], [525, 119], [535, 180], [505, 224], [438, 238], [383, 210]]),
      region("security-auth", "인증 · 보안", [605, 145], [[537, 66], [577, 39], [633, 42], [674, 73], [688, 126], [657, 174], [595, 187], [543, 151]]),
      region("network", "네트워크", [750, 230], [[661, 173], [704, 145], [776, 145], [838, 177], [865, 224], [842, 274], [777, 298], [703, 281], [662, 235]]),
      region("docker", "Docker", [810, 353], [[753, 297], [808, 275], [884, 292], [937, 325], [956, 380], [927, 426], [862, 447], [789, 428], [750, 383]]),
    ],
  },
  devops: {
    jobId: "devops",
    textureKey: "world-career-devops",
    assetPath: "/assets/wallpapers/career-paths/devops-path-map-v1.png",
    title: "DevOps 엔지니어 경로",
    completionCaptureIds: [],
    regions: [
      region("network", "네트워크", [80, 435], [[1, 347], [31, 308], [90, 300], [130, 330], [138, 381], [118, 440], [70, 465], [20, 450]]),
      region("docker", "Docker", [220, 379], [[116, 318], [165, 286], [235, 286], [286, 308], [320, 347], [314, 380], [282, 412], [230, 430], [175, 420], [124, 385]]),
      region("cicd", "CI/CD", [395, 315], [[282, 221], [327, 184], [411, 177], [460, 205], [482, 257], [458, 318], [405, 350], [350, 340], [315, 318], [282, 291]]),
      region("kubernetes", "Kubernetes", [520, 225], [[450, 125], [481, 91], [548, 91], [607, 121], [632, 177], [611, 232], [554, 266], [486, 252], [456, 207]]),
      region("cloud-iac", "Cloud · IaC", [646, 369], [[526, 306], [575, 267], [660, 262], [741, 288], [780, 340], [757, 397], [687, 427], [605, 417], [539, 371]]),
      region("monitoring", "모니터링", [740, 205], [[648, 93], [693, 52], [754, 48], [810, 80], [836, 136], [818, 201], [770, 241], [704, 234], [660, 191]]),
    ],
  },
  "data-engineer": {
    jobId: "data-engineer",
    textureKey: "world-career-data-engineer",
    assetPath: "/assets/wallpapers/career-paths/data-engineer-path-map-v1.png",
    title: "데이터 엔지니어 경로",
    completionCaptureIds: [],
    regions: [
      region("python", "Python", [114, 400], [[17, 333], [60, 290], [125, 281], [189, 306], [224, 355], [215, 415], [168, 459], [91, 470], [30, 431]]),
      region("sql", "SQL · 데이터 모델링", [229, 203], [[130, 143], [177, 101], [252, 89], [330, 111], [380, 158], [378, 219], [329, 267], [253, 287], [176, 259], [132, 210]]),
      region("data-pipeline", "데이터 파이프라인", [455, 369], [[383, 309], [430, 269], [510, 257], [582, 284], [624, 333], [611, 391], [555, 435], [476, 445], [411, 410]]),
      region("docker", "Docker", [709, 157], [[612, 62], [655, 25], [721, 22], [770, 52], [792, 109], [775, 150], [756, 180], [710, 198], [665, 190], [620, 151]]),
      region("orchestration", "오케스트레이션", [785, 284], [[710, 198], [756, 180], [807, 163], [866, 194], [893, 246], [878, 305], [827, 344], [761, 340], [713, 302]]),
      region("monitoring", "모니터링", [858, 74], [[794, 25], [826, 1], [895, 1], [944, 28], [958, 75], [938, 123], [890, 151], [833, 140], [798, 101]]),
    ],
  },
  "data-analyst": {
    jobId: "data-analyst",
    textureKey: "world-career-data-analyst",
    assetPath: "/assets/wallpapers/career-paths/data-analyst-path-map-v1.png",
    title: "데이터 분석가 경로",
    completionCaptureIds: [],
    regions: [
      region("sql", "SQL", [272, 412], [[3, 350], [50, 319], [122, 310], [195, 327], [241, 368], [245, 423], [205, 469], [130, 486], [55, 465], [8, 418]]),
      region("statistics", "기초 통계", [431, 326], [[194, 251], [253, 215], [339, 211], [418, 233], [466, 278], [462, 331], [414, 369], [332, 381], [256, 359], [207, 316]]),
      region("visualization", "데이터 시각화", [580, 241], [[448, 155], [492, 116], [559, 104], [625, 126], [664, 166], [660, 218], [620, 257], [552, 270], [488, 248], [449, 207]]),
      region("bi-tools", "BI 도구", [747, 183], [[704, 55], [752, 11], [829, 1], [903, 23], [949, 66], [958, 122], [925, 172], [900, 183], [850, 202], [790, 195], [725, 146]]),
      region("python", "분석용 Python", [811, 282], [[790, 202], [850, 202], [900, 183], [925, 229], [957, 273], [946, 320], [899, 354], [831, 362], [772, 337], [741, 289], [747, 233]]),
    ],
  },
};

export function careerPathFor(jobId: JobId): CareerPathDefinition {
  return CAREER_PATHS[jobId];
}

/** Completion is derived from the dex, so it stays valid across saves and shared chapters. */
export function isCareerPathComplete(
  path: CareerPathDefinition,
  captured: ReadonlySet<string>
): boolean {
  const required = path.completionCaptureIds;
  return required.length > 0 && required.every((id) => captured.has(id));
}

/** Every completed primary career, derived solely from its required dex captures. */
export function completedCareerPathIds(
  captured: ReadonlySet<string>,
  paths: Readonly<Record<JobId, CareerPathDefinition>> = CAREER_PATHS
): ReadonlySet<JobId> {
  return new Set(
    (Object.keys(paths) as JobId[]).filter((jobId) =>
      isCareerPathComplete(paths[jobId], captured)
    )
  );
}
