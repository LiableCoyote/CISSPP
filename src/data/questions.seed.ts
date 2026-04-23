import { QUESTIONS_D1_D4 } from "./questions.seed.D1-D4";
import { QUESTIONS_D5_D8 } from "./questions.seed.D5-D8";

export const ALL_QUESTIONS = [...QUESTIONS_D1_D4, ...QUESTIONS_D5_D8];

export const questionsByDomain = (domainId: number) =>
  ALL_QUESTIONS.filter(q => q.domainId === domainId);

export const randomQuestion = () =>
  ALL_QUESTIONS[Math.floor(Math.random() * ALL_QUESTIONS.length)];

export const questionsByTag = (tag: string) =>
  ALL_QUESTIONS.filter(q => q.tags.includes(tag));
