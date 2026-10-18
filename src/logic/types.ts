export const CATEGORIES = ['한국사', '과학', '지리', '예술과 문화'] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Option { id: string; text: string }
export interface Source { institution: string; title: string; url: string; supportedFacts: string[]; checkedAt: string }
export interface Question {
  id: string; category: Category; question: string; options: Option[]; correctOptionId: string;
  explanation: string; sources: Source[]; verificationStatus: string;
  review: { stage3?: { result: string; sourceReopened: boolean; checkedAt: string } };
}
export interface CategoryResult { correct: number; total: number }
export type CategoryResults = Record<Category, CategoryResult>;
export interface Completion {
  id: string; nickname: string; score: number; correctCount: number;
  categoryResults: CategoryResults; completedAt: string; bankVersion: string;
}
export interface RankedCompletion extends Completion { rank: number }
export const emptyResults = (): CategoryResults => Object.fromEntries(CATEGORIES.map(c => [c, { correct: 0, total: 0 }])) as CategoryResults;
export const normalizeNickname = (name: string): string => name.normalize('NFC').replace(/\s/gu, '');
export const validNickname = (name: string): boolean => name === normalizeNickname(name) && Array.from(name).length >= 1 && Array.from(name).length <= 12 && !/[\u0000-\u001f\u007f]/u.test(name);
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
