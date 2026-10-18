import rawBank from '../data/question-bank.json';
import { CATEGORIES, isObject, nonempty, type Category, type Question } from './types';

export function safeSourceUrl(value: unknown): boolean {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { return false; }
}
function validQuestion(value: unknown): value is Question {
  if (!isObject(value) || !nonempty(value.id) || !CATEGORIES.includes(value.category as Category) || !nonempty(value.question) || !nonempty(value.explanation)) return false;
  if (!Array.isArray(value.options) || value.options.length !== 4) return false;
  const options = value.options;
  if (!options.every(o => isObject(o) && nonempty(o.id) && nonempty(o.text))) return false;
  if (new Set(options.map(o => o.id)).size !== 4 || new Set(options.map(o => o.text.normalize('NFKC').trim())).size !== 4) return false;
  if (!options.some(o => o.id === value.correctOptionId)) return false;
  if (!Array.isArray(value.sources) || !value.sources.length || !value.sources.every(s => isObject(s) && nonempty(s.institution) && nonempty(s.title) && safeSourceUrl(s.url) && nonempty(s.checkedAt) && Array.isArray(s.supportedFacts) && s.supportedFacts.length > 0 && s.supportedFacts.every(nonempty))) return false;
  return true;
}
export function inspectBank(raw: unknown = rawBank) {
  const issues: string[] = [];
  const counts = Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<Category, number>;
  if (!isObject(raw) || !nonempty(raw.bankVersion) || !Array.isArray(raw.questions)) return { version: '확인 불가', questions: [] as Question[], counts, issues: ['문제 은행의 형식을 읽을 수 없습니다.'], canStart: false };
  const idCounts = new Map<string, number>();
  for (const q of raw.questions) if (isObject(q) && nonempty(q.id)) idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
  const questions = raw.questions.filter((q): q is Question => {
    if (!isObject(q) || q.verificationStatus !== '검증 완료') return false;
    const stage3 = isObject(q.review) && isObject(q.review.stage3) ? q.review.stage3 : null;
    if (!validQuestion(q) || idCounts.get(q.id) !== 1 || stage3?.result !== '통과' || stage3.sourceReopened !== true || !nonempty(stage3.checkedAt)) {
      issues.push(`${typeof q.id === 'string' ? q.id : 'ID 없음'}: 문제 형식 또는 재검수 승인 기록을 확인해 주세요.`); return false;
    }
    return true;
  });
  for (const q of questions) counts[q.category]++;
  for (const category of CATEGORIES) if (counts[category] < 3) issues.push(`${category}: 검증 완료 문제가 ${counts[category]}개입니다. 최소 3개가 필요합니다.`);
  if (raw.approvedForGameDevelopment !== true) issues.push('문제 은행의 재검수 인계 승인이 없습니다.');
  return { version: raw.bankVersion, questions, counts, issues, canStart: raw.approvedForGameDevelopment === true && CATEGORIES.every(c => counts[c] >= 3) };
}
export type BankInfo = ReturnType<typeof inspectBank>;
export const bank = inspectBank();
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function drawQuestions(info: BankInfo = bank, random: () => number = Math.random): Question[] {
  if (!info.canStart) throw new Error(info.issues.join(' ') || '출제할 검증 문제가 부족합니다.');
  return shuffle(CATEGORIES.flatMap(c => shuffle(info.questions.filter(q => q.category === c), random).slice(0, 3)), random)
    .map(q => ({ ...q, options: shuffle(q.options, random) }));
}
