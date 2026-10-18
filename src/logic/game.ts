import { emptyResults, normalizeNickname, validNickname, type Completion, type Question } from './types';
export interface Answer { questionId: string; selectedId: string; correct: boolean }
export interface Game {
  id: string; nickname: string; bankVersion: string; questions: Question[]; index: number;
  selectedId: string | null; answers: Answer[]; phase: 'question' | 'feedback' | 'complete'; completedAt: string | null;
}
export type GameAction = { type: 'select'; questionId: string; optionId: string } | { type: 'submit'; questionId: string } | { type: 'next'; questionId: string; now: string };
export function createGame(id: string, nickname: string, bankVersion: string, questions: Question[]): Game {
  const clean = normalizeNickname(nickname);
  if (!validNickname(clean)) throw new Error('닉네임은 공백을 제외한 1~12자로 입력해 주세요.');
  if (questions.length !== 12 || new Set(questions.map(q => q.id)).size !== 12) throw new Error('중복 없는 12문제가 필요합니다.');
  return { id, nickname: clean, bankVersion, questions, index: 0, selectedId: null, answers: [], phase: 'question', completedAt: null };
}
export function gameReducer(state: Game, action: GameAction): Game {
  const q = state.questions[state.index];
  if (state.phase === 'complete' || action.questionId !== q.id) return state;
  if (action.type === 'select') return state.phase === 'question' && q.options.some(o => o.id === action.optionId) ? { ...state, selectedId: action.optionId } : state;
  if (action.type === 'submit') {
    if (state.phase !== 'question' || !state.selectedId || state.answers.some(a => a.questionId === q.id)) return state;
    return { ...state, phase: 'feedback', answers: [...state.answers, { questionId: q.id, selectedId: state.selectedId, correct: state.selectedId === q.correctOptionId }] };
  }
  if (state.phase !== 'feedback') return state;
  if (state.index === 11 && state.answers.length === 12) return { ...state, phase: 'complete', completedAt: action.now };
  return { ...state, index: state.index + 1, selectedId: null, phase: 'question' };
}
export function completionFromGame(game: Game): Completion {
  if (game.phase !== 'complete' || game.answers.length !== 12 || !game.completedAt) throw new Error('12문제를 마친 게임만 기록할 수 있습니다.');
  const categoryResults = emptyResults();
  for (const q of game.questions) {
    const answer = game.answers.find(a => a.questionId === q.id);
    if (!answer) throw new Error('답안이 누락되었습니다.');
    categoryResults[q.category].total++;
    if (answer.correct) categoryResults[q.category].correct++;
  }
  const correctCount = game.answers.filter(a => a.correct).length;
  return { id: game.id, nickname: game.nickname, score: correctCount * 10, correctCount, categoryResults, completedAt: game.completedAt, bankVersion: game.bankVersion };
}
