// 구조·승인 필드 검사 전용. 출처 원문이나 사실의 진실성은 검사하지 않는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bankPath = process.argv[2] || fileURLToPath(new URL('../src/data/question-bank.json', import.meta.url));
const outputPath = process.argv[3];
const categories = ['한국사', '과학', '지리', '예술과 문화'];
const errors = [];
const warnings = [];
const counts = Object.fromEntries(categories.map(c => [c, 0]));
const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;
const norm = v => v.normalize('NFKC').replace(/\s+/gu, ' ').trim();
let bank;
try { bank = JSON.parse(readFileSync(bankPath, 'utf8')); }
catch (error) { console.error(`문제 은행 읽기 실패: ${error.message}`); process.exit(1); }
if (!Array.isArray(bank.questions)) { console.error('questions 배열 없음'); process.exit(1); }
if (!nonEmpty(bank.bankVersion)) errors.push('은행 버전 없음');
if (bank.defaultNewQuestionStatus !== '확인 필요') errors.push('신규 문제 기본 상태가 확인 필요가 아님');
const ids = new Set();
const prompts = new Map();
for (const q of bank.questions) {
 const label = nonEmpty(q.id) ? q.id : '(ID 없음)';
 if (!nonEmpty(q.id) || ids.has(q.id)) errors.push(`${label}: 문제 ID 없거나 중복`);
 ids.add(q.id);
 if (!categories.includes(q.category)) errors.push(`${label}: 허용되지 않은 분야`);
 for (const key of ['question','explanation']) if (!nonEmpty(q[key])) errors.push(`${label}: ${key} 비어 있음`);
 if (nonEmpty(q.question)) {
  const key=norm(q.question);
  if (prompts.has(key)) errors.push(`${label}: 질문 문장 중복 (${prompts.get(key)})`);
  prompts.set(key,label);
 }
 if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${label}: 보기 4개 아님`);
 const options=Array.isArray(q.options)?q.options:[];
 const optionIds=new Set(); const optionTexts=new Set();
 for (const o of options) {
  if (!nonEmpty(o.id) || optionIds.has(o.id)) errors.push(`${label}: 보기 ID 없거나 중복`);
  optionIds.add(o.id);
  if (!nonEmpty(o.text)) errors.push(`${label}: 보기 내용 비어 있음`);
  else { const value=norm(o.text); if (optionTexts.has(value)) errors.push(`${label}: 보기 내용 중복`); optionTexts.add(value); }
 }
 if (!nonEmpty(q.correctOptionId) || !optionIds.has(q.correctOptionId)) errors.push(`${label}: 정답 ID 불일치`);
 if (!['초안','확인 필요','검증 완료'].includes(q.verificationStatus)) errors.push(`${label}: 검증 상태 오류`);
 if (!Array.isArray(q.sources) || q.sources.length === 0) errors.push(`${label}: 출처 없음`);
 for (const source of q.sources || []) {
  for (const key of ['institution','title','url','checkedAt','evidenceLocation']) if (!nonEmpty(source[key])) errors.push(`${label}: 출처 ${key} 없음`);
  if (!Array.isArray(source.supportedFacts) || !source.supportedFacts.length || !source.supportedFacts.every(nonEmpty)) errors.push(`${label}: 근거 사실 없음`);
  try { if (new URL(source.url).protocol !== 'https:') throw new Error(); } catch { errors.push(`${label}: 출처 URL 형식 오류`); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt||'')) errors.push(`${label}: 출처 확인 날짜 형식 오류`);
 }
 if (q.verificationStatus==='검증 완료') {
  if (!nonEmpty(q.checkedAt)) errors.push(`${label}: 문제 확인 날짜 없음`);
  const review=q.review?.stage3;
  if (review?.result!=='통과' || !nonEmpty(review?.checkedAt) || review?.sourceReopened!==true) errors.push(`${label}: 3단계 승인 기록 없음`);
  if (!Array.isArray(q.review?.distractors) || q.review.distractors.length!==3) errors.push(`${label}: 오답 검수 3개 아님`);
  else {
   const distractorIds=new Set(q.review.distractors.map(d=>d.optionId));
   if (distractorIds.size!==3 || distractorIds.has(q.correctOptionId) || [...distractorIds].some(id=>!optionIds.has(id))) errors.push(`${label}: 오답 검수 ID 불일치`);
   if (!q.review.distractors.every(d=>nonEmpty(d.reason))) errors.push(`${label}: 오답 근거 비어 있음`);
  }
  if (review?.result==='통과' && categories.includes(q.category)) counts[q.category]++;
 }
}
for (const category of categories) {
 if (counts[category]<3) errors.push(`${category}: 출제 가능한 검증 완료 문제 3개 미만`);
 const target = Number.isInteger(bank.targetQuestionsPerCategory) && bank.targetQuestionsPerCategory >= 3 ? bank.targetQuestionsPerCategory : 10;
 if (counts[category]<target) warnings.push(`${category}: 목표 ${target}개 미달`);
}
if (bank.approvedForGameDevelopment!==true) errors.push('개발 단계 인계 승인 없음');
const result={stage:'3단계 구조 검사',bankVersion:bank.bankVersion,questionCount:bank.questions.length,eligibleCounts:counts,
 checks:['문제 ID 중복 없음','보기 정확히 4개','문제 안 보기 ID 중복 없음','빈 문제·보기·해설 없음','문제 안 보기 내용 중복 없음','정답 ID가 보기에 존재','필수 출처 정보 존재','분야별 최소 3개 확보','질문 문장 중복 없음','검수 승인 및 오답 기록 ID 대응'],
 errors,warnings,passed:errors.length===0,provesFactualTruth:false,
 note:'이 프로그램은 저장된 구조와 승인 필드를 검사한다. 원문 열람 및 사실 검증을 수행하지 않는다.'};
if (outputPath) writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n','utf8');
console.log(JSON.stringify(result,null,2));
process.exitCode=errors.length ? 1 : 0;
