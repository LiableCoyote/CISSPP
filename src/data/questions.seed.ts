import { QUESTIONS_D1_D4 } from "./questions.seed.D1-D4";
import { QUESTIONS_D5_D8 } from "./questions.seed.D5-D8";
import { SCENARIO_QUESTIONS } from "./questions.seed.scenarios";
import { EXTRA_QUESTIONS_D1_D4 } from "./questions.seed.extra.D1-D4";
import { EXTRA_QUESTIONS_D5_D8 } from "./questions.seed.extra.D5-D8";
import { EXTRA_QUESTIONS_2 } from "./questions.seed.extra2";
import { EXTRA_QUESTIONS_3 } from "./questions.seed.extra3";

export const ALL_QUESTIONS = [
  ...QUESTIONS_D1_D4,
  ...QUESTIONS_D5_D8,
  ...SCENARIO_QUESTIONS,
  ...EXTRA_QUESTIONS_D1_D4,
  ...EXTRA_QUESTIONS_D5_D8,
  ...EXTRA_QUESTIONS_2,
  ...EXTRA_QUESTIONS_3,
];

export const questionsByDomain = (domainId: number) =>
  ALL_QUESTIONS.filter(q => q.domainId === domainId);

export const randomQuestion = () =>
  ALL_QUESTIONS[Math.floor(Math.random() * ALL_QUESTIONS.length)];

export const questionsByTag = (tag: string) =>
  ALL_QUESTIONS.filter(q => q.tags.includes(tag));
