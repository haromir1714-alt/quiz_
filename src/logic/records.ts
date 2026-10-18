import { CATEGORIES, isObject, nonempty, validNickname, type Completion, type RankedCompletion } from './types';
export const RECORD_PREFIX = 'knowledge-quiz:completed:v1:';
export interface StoragePort { readonly length: number; key(i: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type RecordSnapshot = { records: Completion[]; warnings: string[] };
export function isCompletion(v: unknown): v is Completion {
  if (!isObject(v) || !nonempty(v.id) || !nonempty(v.bankVersion) || typeof v.nickname !== 'string' || !validNickname(v.nickname) || !nonempty(v.completedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v.completedAt) || !Number.isFinite(Date.parse(v.completedAt))) return false;
  if (new Date(v.completedAt).toISOString().replace('.000Z', 'Z') !== v.completedAt.replace('.000Z', 'Z')) return false;
  if (typeof v.correctCount !== 'number' || !Number.isInteger(v.correctCount) || v.correctCount < 0 || v.correctCount > 12 || v.score !== v.correctCount * 10 || !isObject(v.categoryResults)) return false;
  let totalCorrect = 0;
  for (const category of CATEGORIES) {
    const r = v.categoryResults[category];
    if (!isObject(r) || r.total !== 3 || typeof r.correct !== 'number' || !Number.isInteger(r.correct) || r.correct < 0 || r.correct > 3) return false;
    totalCorrect += r.correct;
  }
  return totalCorrect === v.correctCount;
}
function parseRecord(text: string, key: string): Completion {
  const envelope: unknown = JSON.parse(text);
  if (!isObject(envelope) || envelope.schemaVersion !== 1 || !isCompletion(envelope.record) || key !== RECORD_PREFIX + envelope.record.id) throw new Error('기록 형식 오류');
  return envelope.record;
}
export function browserStorage(): StoragePort { return window.localStorage; }
export function loadRecords(getStorage: () => StoragePort = browserStorage): RecordSnapshot {
  const records: Completion[] = []; const warnings: string[] = [];
  try {
    const storage = getStorage();
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k && k.startsWith(RECORD_PREFIX));
    for (const key of keys) {
      try { const raw = storage.getItem(key); if (raw !== null) records.push(parseRecord(raw, key)); }
      catch { warnings.push('손상되었거나 지원하지 않는 기록을 순위에서 제외했습니다. 원본은 자동 삭제하지 않았습니다.'); }
    }
  } catch { warnings.push('브라우저 기록을 읽을 수 없습니다. 저장 설정을 확인해 주세요.'); }
  return { records, warnings: [...new Set(warnings)] };
}
export type SaveResult = { ok: true; duplicate: boolean } | { ok: false; message: string };
export function saveRecord(record: Completion, getStorage: () => StoragePort = browserStorage): SaveResult {
  try {
    if (!isCompletion(record)) throw new Error('완료 기록 형식 오류');
    const storage = getStorage(); const key = RECORD_PREFIX + record.id; const existing = storage.getItem(key);
    if (existing !== null) {
      const stored = parseRecord(existing, key);
      if (JSON.stringify(stored) !== JSON.stringify(record)) throw new Error('같은 ID의 다른 기록');
      return { ok: true, duplicate: true };
    }
    const text = JSON.stringify({ schemaVersion: 1, record });
    storage.setItem(key, text);
    if (storage.getItem(key) !== text) throw new Error('저장 후 확인 실패');
    return { ok: true, duplicate: false };
  } catch { return { ok: false, message: '기록 저장을 확인하지 못했습니다. 결과는 이 화면에서 확인할 수 있지만 순위 등록을 확정할 수 없습니다. 브라우저의 저장 공간·권한을 확인하고 다시 시도해 주세요.' }; }
}
export function deleteRecords(getStorage: () => StoragePort = browserStorage): SaveResult {
  try {
    const storage = getStorage();
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => !!k && k.startsWith(RECORD_PREFIX));
    for (const key of keys) storage.removeItem(key);
    if (keys.some(key => storage.getItem(key) !== null)) throw new Error('삭제 확인 실패');
    return { ok: true, duplicate: false };
  } catch { return { ok: false, message: '기록을 모두 삭제하지 못했습니다. 남아 있는 기록을 다시 불러왔습니다.' }; }
}
export function rankRecords(records: readonly Completion[], version: string): RankedCompletion[] {
  const sorted = records.filter(r => r.bankVersion === version).sort((a, b) => b.score - a.score || Date.parse(a.completedAt) - Date.parse(b.completedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let rank = 0;
  return sorted.map((r, i) => { if (i === 0 || r.score !== sorted[i - 1].score) rank = i + 1; return { ...r, rank }; });
}
