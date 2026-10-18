// 원문 확인 전의 빈 초안만 만든다. AI 생성·자동 사실 검증·자동 승인 기능은 없다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const [id, category] = process.argv.slice(2);
const categories = ['한국사', '과학', '지리', '예술과 문화'];
if (!id || !/^[a-z]+-\d{3,}$/u.test(id) || !categories.includes(category)) {
  console.error('사용법: npm run new:question -- hist-011 한국사\n분야: 한국사 / 과학 / 지리 / "예술과 문화"');
  process.exit(1);
}
const bank = JSON.parse(readFileSync(new URL('../src/data/question-bank.json', import.meta.url), 'utf8'));
if (bank.questions.some(q => q.id === id)) { console.error('이미 문제 은행에 있는 ID입니다.'); process.exit(1); }
const draft = {
  id, category, question: '',
  options: ['a', 'b', 'c', 'd'].map(letter => ({ id: `${id}-${letter}`, text: '' })),
  correctOptionId: '', explanation: '',
  sources: [{ institution: '', title: '', url: '', supportedFacts: [], checkedAt: '', evidenceLocation: '' }],
  checkedAt: '', verificationStatus: '확인 필요',
  review: { stage: '초안 작성', independentReviewCompleted: false, secondPassReviewCompleted: false,
    answerRationale: '', distractors: [], stage3: { result: '확인 필요', sourceReopened: false, checkedAt: '' } },
};
mkdirSync(new URL('../drafts/', import.meta.url), { recursive: true });
const path = new URL(`../drafts/${id}.json`, import.meta.url);
try { writeFileSync(path, JSON.stringify(draft, null, 2) + '\n', { flag: 'wx' }); }
catch { console.error('초안을 저장하지 못했습니다. 동일한 초안 파일이 있는지 확인해 주세요. 덮어쓰지 않았습니다.'); process.exit(1); }
console.log(`확인 필요 초안 생성: ${fileURLToPath(path)}\n이 파일은 출제 대상이 아닙니다. docs/CONTENT-GUIDE.md의 검수 절차를 따라 주세요.`);
