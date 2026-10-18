// 검수한 JSON을 읽기용 문서로 옮긴다. 사실을 검증하거나 승인하지 않는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const project = new URL('../', import.meta.url);
const bank = JSON.parse(readFileSync(new URL('src/data/question-bank.json', project), 'utf8'));
const categories = ['한국사', '과학', '지리', '예술과 문화'];
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const answerOf = q => q.options.find(o => o.id === q.correctOptionId)?.text ?? '(정답 ID 확인 필요)';
const counts = categories.map(c => `${c} ${bank.questions.filter(q => q.category === c).length}개`).join(' · ');
const intro = `총 ${bank.questions.length}문제 · 은행 버전 ${bank.bankVersion}`;
const markdown = [`# 전체 문제 은행 — ${bank.bankVersion}`, '', intro, '', counts, '',
  '앱의 실제 원본은 `src/data/question-bank.json`이다. 이 문서는 원본을 옮긴 읽기용 사본이며 사실을 자동 검증하지 않는다. 출처의 실제 확인일과 검수 상태는 문항별로 표시한다.', '',
  '더 쉽게 읽으려면 같은 폴더의 `question-bank.html`을 브라우저로 연다. Ctrl+F로 문제 ID나 단어를 검색할 수 있다.', ''];
const sections = categories.map((category, index) => {
  const questions = bank.questions.filter(q => q.category === category);
  markdown.push(`## ${category} — ${questions.length}문제`, '');
  const cards = questions.map(q => {
    const answer = answerOf(q);
    markdown.push(`### ${q.id}: ${q.question}`, '', ...q.options.map(o => `- ${o.id}: ${o.text}`), '',
      `정답: **${answer}** (${q.correctOptionId})`, `해설: ${q.explanation}`, '',
      ...q.sources.flatMap(s => [`- 출처: ${s.institution} — [${s.title}](${s.url})`, `- 뒷받침하는 사실: ${s.supportedFacts.join(' / ')}`, `- 원문 위치: ${s.evidenceLocation}`, `- 실제 확인일: ${s.checkedAt}`]),
      `- 검수 상태: ${q.verificationStatus}`, '');
    return `<article id="${escape(q.id)}" data-question-id="${escape(q.id)}" data-correct-option-id="${escape(q.correctOptionId)}">
      <p class="meta">${escape(q.id)} · ${escape(q.category)} · ${escape(q.verificationStatus)}</p>
      <h3>${escape(q.question)}</h3>
      <ol>${q.options.map(o => `<li data-option-id="${escape(o.id)}">${escape(o.text)}</li>`).join('')}</ol>
      <p class="answer">정답: <strong>${escape(answer)}</strong></p>
      <p class="explanation">${escape(q.explanation)}</p>
      <div class="sources">${q.sources.map(s => {
        const protocol = new URL(s.url).protocol;
        if (protocol !== 'https:') throw new Error(`${q.id}: 출처 HTTPS 주소를 확인하세요.`);
        return `<p><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.institution)} · ${escape(s.title)}</a><br><span>근거 사실: ${escape(s.supportedFacts.join(' / '))}<br>원문 위치: ${escape(s.evidenceLocation)}<br>확인일: ${escape(s.checkedAt)}</span></p>`;
      }).join('')}</div>
      <a class="back" href="#top">맨 위로</a>
    </article>`;
  }).join('\n');
  return `<section id="category-${index}"><h2>${escape(category)} <span>${questions.length}문제</span></h2>${cards}</section>`;
}).join('\n');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>상식 한 바퀴 · 전체 문제 확인</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f7f3;color:#20372d;font:16px/1.8 system-ui,"Malgun Gothic",sans-serif}main{max-width:920px;margin:auto;padding:36px 20px 64px}h1{font-size:30px;line-height:1.4}h2{margin-top:48px}h2 span{font-size:15px;font-weight:400;color:#607164}h3{font-size:20px;line-height:1.7;overflow-wrap:anywhere}a{color:#14614a;text-underline-offset:3px}a:focus-visible{outline:3px solid #ad7020;outline-offset:4px}nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}nav a{border:1px solid #b9cbbc;padding:8px 16px;border-radius:9px;background:white}article{background:white;border:1px solid #d8e1d7;border-radius:15px;padding:24px;margin:20px 0;break-inside:avoid}.meta{font-size:13px;color:#667469;margin:0}ol{padding-left:25px}li{padding:5px 0}.answer{border-top:1px solid #e0e8df;padding-top:18px}.sources{font-size:13px;overflow-wrap:anywhere;color:#506053}.sources p{margin:14px 0}.back{font-size:12px}.notice{background:#e6eee3;border-radius:12px;padding:16px 20px}.sub{color:#56695a}@media print{body{background:white}main{max-width:none}nav,.back{display:none}article{box-shadow:none}a{color:inherit}}
</style></head><body><main id="top"><header><p class="sub">상식 한 바퀴 · 검수용 전체 목록</p><h1>${escape(intro)}</h1><p>${escape(counts)}</p><div class="notice">게임을 실행하지 않고 전체 문제·보기·정답·해설·출처를 확인하는 문서입니다. Ctrl+F로 문제 ID나 단어를 검색하세요. 출처 링크는 인터넷 연결이 필요합니다.<br>이 문서는 원본 JSON을 옮긴 읽기용 사본이며 사실 검증을 자동 수행하지 않습니다. 외부 전문가의 독립 검수는 수행하지 않았습니다.</div><nav aria-label="분야 이동">${categories.map((c, i) => `<a href="#category-${i}">${escape(c)}</a>`).join('')}</nav></header>${sections}<footer><p>원본: src/data/question-bank.json · 수정 후에는 프로젝트 폴더에서 npm run export:questions를 실행해 이 문서를 갱신하세요.</p></footer></main></body></html>`;
writeFileSync(new URL('docs/question-bank.md', project), markdown.join('\n').trimEnd() + '\n', 'utf8');
writeFileSync(new URL('docs/question-bank.html', project), html, 'utf8');
console.log(`읽기용 문서 생성: ${bank.bankVersion} · ${bank.questions.length}문제`);
console.log(fileURLToPath(new URL('docs/question-bank.html', project)));
