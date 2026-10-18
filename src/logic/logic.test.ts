import { bank, drawQuestions, inspectBank, shuffle } from './content';
import rawBank from '../data/question-bank.json';
import { completionFromGame, createGame, gameReducer, type Game } from './game';
import { CATEGORIES, emptyResults, normalizeNickname, validNickname, type Completion } from './types';
import { deleteRecords, isCompletion, loadRecords, rankRecords, RECORD_PREFIX, saveRecord, type StoragePort } from './records';

function seed(value: number) { return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
function finished(correctCount: number, id = 'game-test', nickname = '테스터'): Game {
  const questions = drawQuestions(bank, seed(21)).map(q => ({ ...q, options: [...q.options].reverse() }));
  let game = createGame(id, nickname, bank.version, questions);
  for (let i = 0; i < 12; i++) {
    const q = game.questions[i];
    const selected = i < correctCount ? q.correctOptionId : q.options.find(o => o.id !== q.correctOptionId)!.id;
    game = gameReducer(game, { type: 'select', questionId: q.id, optionId: selected });
    game = gameReducer(game, { type: 'submit', questionId: q.id });
    game = gameReducer(game, { type: 'next', questionId: q.id, now: '2026-10-17T09:00:00.000Z' });
  }
  return game;
}
function record(score: number, id: string, date = '2026-10-17T09:00:00Z', version = '1.0.0'): Completion {
  const categoryResults = emptyResults(); let left = score / 10;
  for (const c of CATEGORIES) { const correct = Math.min(left, 3); categoryResults[c] = { total: 3, correct }; left -= correct; }
  return { id, nickname: '테스터', score, correctCount: score / 10, categoryResults, completedAt: date, bankVersion: version };
}
class MemoryStorage implements StoragePort {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}
describe('문제 출제', () => {
  it('재검수한 200문제와 분야별 50문제가 들어 있다', () => {
    expect(bank.canStart).toBe(true); expect(bank.version).toBe('1.1.2');
    expect(bank.questions).toHaveLength(200); expect(bank.issues).toEqual([]);
    for (const category of CATEGORIES) expect(bank.questions.filter(q => q.category === category)).toHaveLength(50);
  });
  it('50가지 섞기에서 분야별 3개·총12개이며 중복이 없다', () => {
    for (let i = 1; i <= 50; i++) { const qs = drawQuestions(bank, seed(i)); expect(qs).toHaveLength(12); expect(new Set(qs.map(q => q.id)).size).toBe(12); for (const c of CATEGORIES) expect(qs.filter(q => q.category === c)).toHaveLength(3); }
  });
  it('문제·보기 순서를 섞고 원본을 변경하지 않는다', () => {
    const original = JSON.stringify(rawBank); const first = drawQuestions(bank, seed(3)); const second = drawQuestions(bank, seed(103));
    expect(first.map(q => q.id)).not.toEqual(second.map(q => q.id)); expect(JSON.stringify(rawBank)).toBe(original);
    expect(first.some(q => JSON.stringify(q.options) !== JSON.stringify(bank.questions.find(o => o.id === q.id)!.options))).toBe(true);
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
  it('200문제 각각의 네 보기·24가지 순서에서 채점하고 반복 제출을 무시한다', () => {
    const permutations = <T,>(items: T[]): T[][] => items.length === 0 ? [[]] : items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [item, ...rest]));
    for (const q of bank.questions) for (const options of permutations(q.options)) for (const option of options) {
      const current = { ...q, options };
      const others = bank.questions.filter(other => other.id !== q.id).slice(0, 11);
      let game = createGame('permutation', '검사', bank.version, [current, ...others]);
      game = gameReducer(game, { type: 'select', questionId: q.id, optionId: option.id });
      game = gameReducer(game, { type: 'submit', questionId: q.id });
      expect(game.answers).toHaveLength(1);
      expect(game.answers[0].correct).toBe(option.id === q.correctOptionId);
      expect(gameReducer(game, { type: 'submit', questionId: q.id })).toBe(game);
    }
  });
  it.each(['초안', '확인 필요'])('%s 문제는 제외한다', status => { const raw = structuredClone(rawBank); raw.questions[0].verificationStatus = status; expect(inspectBank(raw).questions.some(q => q.id === raw.questions[0].id)).toBe(false); });
  it('검증 표시만 있고 재검수 승인이 없는 문제는 제외한다', () => { const raw = structuredClone(rawBank); raw.questions[0].review.stage3.result = '확인 필요'; expect(inspectBank(raw).questions).toHaveLength(rawBank.questions.length - 1); });
  it('분야별 최소 3개가 없으면 미검증 문제로 대체하지 않는다', () => { const raw = structuredClone(rawBank); raw.questions = raw.questions.filter(q => q.category !== '과학'); const info = inspectBank(raw); expect(info.canStart).toBe(false); expect(() => drawQuestions(info)).toThrow(/과학/); });
  it('중복 ID·위험한 출처 링크가 있는 문제는 출제하지 않는다', () => { const raw = structuredClone(rawBank); raw.questions[1].id = raw.questions[0].id; raw.questions[2].sources[0].url = 'javascript:alert(1)'; expect(inspectBank(raw).questions).toHaveLength(rawBank.questions.length - 3); });
  it('잘못된 은행 형식은 오류 안내용 결과를 반환한다', () => { expect(inspectBank(null).canStart).toBe(false); expect(inspectBank({}).issues.length).toBeGreaterThan(0); });
});
describe('채점과 상태 전환', () => {
  it.each([[12, 120], [0, 0], [7, 70]])('보기 순서 변경 후 정답 %i개는 %i점', (correct, score) => { const result = completionFromGame(finished(correct)); expect(result.score).toBe(score); expect(result.correctCount).toBe(correct); for (const c of CATEGORIES) expect(result.categoryResults[c].total).toBe(3); });
  it('답 선택 전 제출은 무시한다', () => { const g = createGame('id', '닉네임', bank.version, drawQuestions()); expect(gameReducer(g, { type: 'submit', questionId: g.questions[0].id })).toBe(g); });
  it('중복 제출·채점 후 변경은 무시하고 점수는 한 번만 반영한다', () => {
    let g = createGame('id', '닉네임', bank.version, drawQuestions()); const q = g.questions[0];
    g = gameReducer(g, { type: 'select', questionId: q.id, optionId: q.correctOptionId }); g = gameReducer(g, { type: 'submit', questionId: q.id });
    expect(gameReducer(g, { type: 'submit', questionId: q.id })).toBe(g); expect(gameReducer(g, { type: 'select', questionId: q.id, optionId: q.options[0].id })).toBe(g); expect(g.answers).toHaveLength(1);
  });
  it('연속 다음 클릭의 이전 문제 ID는 다음 문제를 건너뛰지 못한다', () => {
    let g = createGame('id', '닉네임', bank.version, drawQuestions()); const q = g.questions[0];
    g = gameReducer(g, { type: 'select', questionId: q.id, optionId: q.correctOptionId }); g = gameReducer(g, { type: 'submit', questionId: q.id });
    const action = { type: 'next' as const, questionId: q.id, now: '2026-10-17T09:00:00Z' }; g = gameReducer(g, action); expect(gameReducer(g, action)).toBe(g); expect(g.index).toBe(1);
  });
  it('미완료 게임은 완료 기록을 만들지 못한다', () => { const g = createGame('id', '닉네임', bank.version, drawQuestions()); expect(() => completionFromGame(g)).toThrow(); });
  it('완료한 게임 상태는 제출·다음으로 변경되지 않는다', () => { const g = finished(7); expect(gameReducer(g, { type: 'next', questionId: g.questions[11].id, now: 'other' })).toBe(g); });
  it('없는 보기 선택은 무시한다', () => { const g = createGame('id', '닉네임', bank.version, drawQuestions()); expect(gameReducer(g, { type: 'select', questionId: g.questions[0].id, optionId: 'none' })).toBe(g); });
  it('닉네임 공백 제거·유니코드 문자 수를 검사한다', () => { expect(normalizeNickname(' 태 민\t')).toBe('태민'); expect(validNickname('😀'.repeat(12))).toBe(true); expect(validNickname('가'.repeat(13))).toBe(false); expect(validNickname('')).toBe(false); });
});
describe('순위와 기록 저장', () => {
  it('공동 순위 1,1,3과 동점 시각 오름차순을 적용한다', () => { const ranked = rankRecords([record(80, 'late', '2026-10-17T11:00:00Z'), record(70, 'last'), record(80, 'early')], '1.0.0'); expect(ranked.map(r => r.rank)).toEqual([1, 1, 3]); expect(ranked.map(r => r.id)).toEqual(['early', 'late', 'last']); });
  it('버전별 순위를 구분한다', () => { expect(rankRecords([record(120, 'old', undefined, '0.1.0'), record(20, 'new')], '1.0.0').map(r => r.id)).toEqual(['new']); });
  it('1.0.0·1.1.0과 재검수한 현재 은행의 기록을 보존하고 순위를 분리한다', () => {
    const store = new MemoryStorage();
    saveRecord(record(120, 'old-content', undefined, '1.0.0'), () => store);
    saveRecord(record(100, 'expanded-content-v110', undefined, '1.1.0'), () => store);
    saveRecord(record(70, 'expanded-content', undefined, bank.version), () => store);
    const records = loadRecords(() => store).records;
    expect(records).toHaveLength(3);
    expect(rankRecords(records, '1.0.0').map(r => r.id)).toEqual(['old-content']);
    expect(rankRecords(records, '1.1.0').map(r => r.id)).toEqual(['expanded-content-v110']);
    expect(rankRecords(records, bank.version).map(r => r.id)).toEqual(['expanded-content']);
  });
  it('같은 점수·시각은 ID로 표시 순서만 고정한다', () => { expect(rankRecords([record(10, 'z'), record(10, 'a')], '1.0.0').map(r => [r.id, r.rank])).toEqual([['a', 1], ['z', 1]]); });
  it('같은 완료 기록 재저장은 중복을 만들지 않는다', () => { const store = new MemoryStorage(); const r = completionFromGame(finished(7)); expect(saveRecord(r, () => store)).toEqual({ ok: true, duplicate: false }); expect(saveRecord(r, () => store)).toEqual({ ok: true, duplicate: true }); expect(loadRecords(() => store).records).toHaveLength(1); });
  it('새 저장소 읽기 인스턴스에도 기록이 유지된다', () => { const store = new MemoryStorage(); saveRecord(record(120, 'one'), () => store); expect(loadRecords(() => store).records[0].score).toBe(120); });
  it('서로 다른 게임은 개별 키로 보존한다', () => { const store = new MemoryStorage(); saveRecord(record(20, 'a'), () => store); saveRecord(record(30, 'b'), () => store); expect(loadRecords(() => store).records).toHaveLength(2); });
  it('저장 예외를 성공으로 표시하지 않는다', () => { const store = new MemoryStorage(); store.setItem = () => { throw new Error('QuotaExceeded'); }; expect(saveRecord(record(10, 'id'), () => store).ok).toBe(false); });
  it('localStorage 접근 차단도 예외를 외부로 던지지 않는다', () => { const denied = () => { throw new Error('SecurityError'); }; expect(saveRecord(record(10, 'id'), denied).ok).toBe(false); expect(loadRecords(denied).warnings.length).toBe(1); });
  it('손상 기록은 제외하고 원본과 정상 기록을 보존한다', () => { const store = new MemoryStorage(); store.setItem(RECORD_PREFIX + 'broken', '{oops'); saveRecord(record(20, 'valid'), () => store); expect(loadRecords(() => store).records).toHaveLength(1); expect(loadRecords(() => store).warnings.length).toBe(1); expect(store.getItem(RECORD_PREFIX + 'broken')).toBe('{oops'); });
  it('같은 ID의 다른 기록은 덮어쓰지 않는다', () => { const store = new MemoryStorage(); saveRecord(record(10, 'one'), () => store); expect(saveRecord(record(20, 'one'), () => store).ok).toBe(false); expect(loadRecords(() => store).records[0].score).toBe(10); });
  it('저장 내용의 점수·분야별 결과 일관성을 검사한다', () => { const r = record(70, 'one'); expect(isCompletion(r)).toBe(true); expect(isCompletion({ ...r, score: 120 })).toBe(false); expect(isCompletion({ ...r, correctCount: 6, score: 60 })).toBe(false); });
  it('손상된 완료 날짜나 모호한 날짜 문자열을 거부한다', () => { const r = record(10, 'one'); expect(isCompletion({ ...r, completedAt: '2026-02-31T09:00:00Z' })).toBe(false); expect(isCompletion({ ...r, completedAt: '1' })).toBe(false); });
  it('버전 전체의 앱 기록만 삭제하고 다른 앱 데이터는 남긴다', () => { const store = new MemoryStorage(); store.setItem('another-app', 'keep'); saveRecord(record(0, 'old', undefined, '0.1.0'), () => store); saveRecord(record(10, 'new'), () => store); expect(deleteRecords(() => store).ok).toBe(true); expect(loadRecords(() => store).records).toHaveLength(0); expect(store.getItem('another-app')).toBe('keep'); });
  it('부분 삭제 실패를 성공으로 표시하지 않는다', () => { const store = new MemoryStorage(); saveRecord(record(0, 'one'), () => store); store.removeItem = () => { throw new Error('blocked'); }; expect(deleteRecords(() => store).ok).toBe(false); });
});
