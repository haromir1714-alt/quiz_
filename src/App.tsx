import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bank as defaultBank, drawQuestions, type BankInfo } from './logic/content';
import { completionFromGame, createGame, gameReducer, type Game, type GameAction } from './logic/game';
import { deleteRecords, loadRecords, rankRecords, saveRecord, type SaveResult } from './logic/records';
import { CATEGORIES, normalizeNickname, validNickname, type Category } from './logic/types';
import { ConfirmDialog } from './components/ConfirmDialog';

type View = 'home' | 'play' | 'result' | 'ranking';
const categoryClass = (category: Category) => `topic-${CATEGORIES.indexOf(category)}`;
const symbols = ['史', '✳', '◎', '♫'];
const dateText = (date: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
const uniqueId = () => crypto.randomUUID();
function TopicIcon({ category }: { category: Category }) { return <span aria-hidden="true" className={`topic-icon ${categoryClass(category)}`}>{symbols[CATEGORIES.indexOf(category)]}</span>; }

export default function App({ content = defaultBank }: { content?: BankInfo }) {
  const [view, setView] = useState<View>('home');
  const [nickname, setNickname] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [snapshot, setSnapshot] = useState(() => loadRecords());
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [version, setVersion] = useState(content.version);
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const refresh = () => setSnapshot(loadRecords());
  useEffect(() => {
    const sync = () => setSnapshot(loadRecords());
    window.addEventListener('storage', sync); window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);
  useEffect(() => {
    if (view === 'play' && game?.phase === 'feedback') feedback.current?.focus();
    else heading.current?.focus();
  }, [view, game?.index, game?.phase]);
  useEffect(() => {
    if (game?.phase !== 'complete') return;
    setSaved(saveRecord(completionFromGame(game)));
    setSnapshot(loadRecords());
  }, [game]);

  const currentRanks = rankRecords(snapshot.records, content.version);
  const versions = [...new Set([content.version, ...snapshot.records.map(r => r.bankVersion)])];
  const ranked = rankRecords(snapshot.records, version);
  const score = game ? game.answers.filter(a => a.correct).length * 10 : 0;
  const current = game?.questions[game.index];
  const completed = game?.phase === 'complete' ? completionFromGame(game) : null;
  const ownRank = completed && saved?.ok ? rankRecords(snapshot.records, completed.bankVersion).find(r => r.id === completed.id)?.rank : undefined;
  function act(action: GameAction) { setGame(previous => previous ? gameReducer(previous, action) : previous); }
  function start(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const next = createGame(uniqueId(), nickname, content.version, drawQuestions(content));
      setGame(next); setSaved(null); setView('play');
    } catch (caught) { setError(caught instanceof Error ? caught.message : '게임을 시작할 수 없습니다.'); }
  }
  function reset() { setGame(null); setSaved(null); setError(''); setNotice(''); setView('home'); }
  function openRanking() { refresh(); setVersion(content.version); setNotice(''); setView('ranking'); }

  return <div className="app-shell">
    <a className="skip-link" href="#main">본문으로 이동</a>
    <header className="site-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span><span>상식 한 바퀴<span className="brand-sub">KNOWLEDGE QUIZ</span></span></div>
      <span className="local-badge"><span aria-hidden="true"/>이 브라우저의 퀴즈</span>
    </header>
    <main id="main">
      {snapshot.warnings.length > 0 && <aside className="alert warning" aria-label="기록 저장소 안내">{snapshot.warnings.map(w => <p key={w}>{w}</p>)}</aside>}
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert" role="status">{notice}</p>}

      {view === 'home' && <>
        <div className="home-grid">
          <section className="hero">
            <p className="eyebrow">네 분야, 열두 번의 발견</p>
            <h1 ref={heading} tabIndex={-1}>아는 만큼,<br/><span>새로운 발견.</span></h1>
            <p className="hero-description">역사에서 과학, 세계 곳곳의 문화까지.<br/>상식의 폭을 넓히는 작은 도전을 시작해 보세요.</p>
            <div className="rule-strip"><div><strong>12<span>문제</span></strong><small>분야별 3문제</small></div><div><strong>120<span>점</span></strong><small>정답마다 10점</small></div><div><strong className="no-limit">시간 제한 없음</strong><small>내 속도로 천천히</small></div></div>
            <div className="topics-grid">{CATEGORIES.map(c => <div className="topic-item" key={c}><TopicIcon category={c}/><div><strong>{c}</strong><small>{content.counts[c]}문제 중 3문제 출제</small></div></div>)}</div>
          </section>
          <section className="start-card card" aria-labelledby="start-title">
            <span className="small-step">LET'S BEGIN</span><h2 id="start-title">준비되셨나요?</h2><p>기록에 남길 이름을 알려 주세요.</p>
            <form onSubmit={start}>
              <label htmlFor="nickname">닉네임</label>
              <div className="input-wrap"><input id="nickname" name="nickname" autoComplete="off" value={nickname} onChange={e => setNickname(normalizeNickname(e.target.value))} placeholder="닉네임을 입력하세요" aria-describedby="nickname-help" aria-invalid={nickname.length > 0 && !validNickname(nickname)}/><span aria-hidden="true">{Array.from(nickname).length}/12</span></div>
              <p className="field-help" id="nickname-help">공백을 제외한 1~12자 · 공백은 자동 제거됩니다.</p>
              <button className="button primary full" disabled={!validNickname(nickname) || !content.canStart} type="submit">퀴즈 시작하기 <span aria-hidden="true">↗</span></button>
            </form>
            <button className="button secondary full" onClick={openRanking}>이 브라우저 순위 보기 <span aria-hidden="true">→</span></button>
            <div className="start-note"><span aria-hidden="true">ⓘ</span><p>진행 중 새로고침하면 게임이 초기화됩니다.<br/>완료한 게임의 기록은 유지됩니다.</p></div>
          </section>
        </div>
        {content.issues.length > 0 && <aside className="alert warning"><h2>{content.canStart ? '문제 데이터 안내' : '게임을 시작할 수 없습니다'}</h2>{content.issues.map(i => <p key={i}>{i}</p>)}<p>확인되지 않은 문제를 대신 출제하지 않습니다.</p></aside>}
        <section className="trust-panel" aria-label="콘텐츠와 저장 안내"><div className="trust-icon" aria-hidden="true">✓</div><div><h2>출처를 확인한 문제로, 차근차근</h2><p>저장된 문제 은행에서만 출제합니다. 매 문제마다 해설과 출처를 확인할 수 있습니다.</p><p>완료 기록과 순위는 같은 브라우저·프로필·실행 주소에 저장됩니다. 다른 기기와 공유되지 않습니다.</p></div><span className="bank-chip">문제 은행 v{content.version}</span></section>
        {currentRanks[0] && <p className="best-record">이 브라우저 최고 점수 <strong>{currentRanks[0].score}점</strong><span>{currentRanks[0].nickname}</span></p>}
      </>}

      {view === 'play' && game && current && <section className="play-wrap">
        <div className="play-top"><span className="eyebrow">상식 한 바퀴</span><span className="current-score">현재 점수 <strong>{score}</strong><span> / 120</span></span></div>
        <div className="progress-caption"><span>문제 <strong>{game.index + 1}</strong> / 12</span><span>{game.answers.length}문제 채점 완료</span></div>
        <div className="progress-track" role="progressbar" aria-label="채점 완료 진행도" aria-valuemin={0} aria-valuemax={12} aria-valuenow={game.answers.length}><div style={{ width: `${game.answers.length / 12 * 100}%` }}/></div>
        <div className="question-card card">
          <span className={`category-pill ${categoryClass(current.category)}`}>{current.category}</span>
          <h1 className="question-title" tabIndex={-1} ref={heading}>{current.question}</h1>
          <p className="question-hint">{game.phase === 'question' ? '가장 알맞은 답 하나를 선택해 주세요.' : '채점이 완료되었습니다. 제출한 답은 바꿀 수 없습니다.'}</p>
          <form onSubmit={e => { e.preventDefault(); act({ type: 'submit', questionId: current.id }); }}>
            <fieldset className="options" disabled={game.phase !== 'question'}><legend className="sr-only">보기 선택</legend>{current.options.map((option, index) => {
              const graded = game.phase === 'feedback';
              const isCorrect = graded && option.id === current.correctOptionId;
              const selected = game.selectedId === option.id;
              const wrong = graded && selected && !isCorrect;
              return <label key={option.id} className={`option ${selected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${wrong ? 'incorrect' : ''}`}>
                <input type="radio" name={`answer-${current.id}`} value={option.id} checked={selected} onChange={() => act({ type: 'select', questionId: current.id, optionId: option.id })}/>
                <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span className="option-text">{option.text}</span>
                {graded ? isCorrect ? <span className="option-state">✓ 정답{selected ? ' · 내 선택' : ''}</span> : wrong ? <span className="option-state">✕ 내 선택 · 오답</span> : null : selected ? <span className="option-state">선택됨</span> : null}
              </label>;
            })}</fieldset>
            {game.phase === 'question' && <button className="button primary full submit-button" type="submit" disabled={!game.selectedId}>답 제출하기 <span aria-hidden="true">→</span></button>}
          </form>
          {game.phase === 'feedback' && <>
            <div className={`feedback ${game.answers.at(-1)?.correct ? 'feedback-correct' : 'feedback-wrong'}`} ref={feedback} tabIndex={-1} role="status">
              <p className="feedback-result">{game.answers.at(-1)?.correct ? '✓ 정답입니다! +10점' : '✕ 아쉬워요. 다음 문제에 도전해 보세요.'}</p>
              <p><strong>올바른 정답: {current.options.find(o => o.id === current.correctOptionId)?.text}</strong></p><p>{current.explanation}</p>
              <div className="sources"><span className="source-label">출처 · 새 창으로 열림</span>{current.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.institution} · {source.title}<span aria-hidden="true"> ↗</span></a>)}</div>
            </div>
            <button className="button primary full" onClick={() => { if (game.index === 11) setView('result'); act({ type: 'next', questionId: current.id, now: new Date().toISOString() }); }}>{game.index === 11 ? '결과 보기' : '다음 문제'} <span aria-hidden="true">→</span></button>
          </>}
        </div>
        <p className="play-foot">시간 제한 없이, 한 문제씩. 출처는 채점 후 확인할 수 있습니다.</p>
      </section>}

      {view === 'result' && completed && <section className="result-wrap">
        <p className="eyebrow">열두 번의 도전, 한 바퀴 완료</p><h1 ref={heading} tabIndex={-1}>{completed.nickname}님의 결과</h1><p className="section-description">새롭게 알게 된 상식도 함께 가져가세요.</p>
        <div className="result-card card"><div className="result-score"><span>최종 점수</span><strong>{completed.score}<small> / 120점</small></strong><p>정답 <b>{completed.correctCount}</b>개 · 전체 12문제</p></div><div className="result-rank"><span>이 브라우저 순위</span><strong>{ownRank !== undefined ? `${ownRank}위` : '—'}</strong><p>{saved === null ? '기록 저장 중' : !saved.ok ? '저장 실패 · 순위 미등록' : ownRank !== undefined ? `문제 은행 v${completed.bankVersion} 기준` : '해당 기록이 현재 저장소에 없습니다.'}</p></div></div>
        <div aria-live="polite">{saved?.ok && <p className="saved-message">✓ 완료 기록을 이 브라우저에 저장했습니다.</p>}{saved && !saved.ok && <div className="alert error"><p>{saved.message}</p><button className="button secondary" onClick={() => { setSaved(saveRecord(completed)); refresh(); }}>기록 저장 다시 시도</button></div>}</div>
        <section className="category-results" aria-labelledby="category-result-title"><h2 id="category-result-title">분야별 결과</h2><div className="results-grid">{CATEGORIES.map(c => <div className="category-result card" key={c}><TopicIcon category={c}/><span>{c}</span><strong>{completed.categoryResults[c].correct}<small> / 3</small></strong><div className="mini-progress"><span style={{ width: `${completed.categoryResults[c].correct / 3 * 100}%` }}/></div></div>)}</div></section>
        <p className="ranking-note">순위는 이 브라우저에 저장된 같은 문제 은행 버전의 완료 기록 기준입니다. 같은 점수는 공동 순위입니다.</p>
        <div className="button-row result-actions"><button className="button primary" onClick={reset}>다시 하기 <span aria-hidden="true">↻</span></button><button className="button secondary" onClick={openRanking}>전체 순위 보기</button></div>
      </section>}

      {view === 'ranking' && <section className="ranking-wrap">
        <button className="text-button" onClick={() => setView(game?.phase === 'complete' ? 'result' : 'home')}>← {game?.phase === 'complete' ? '결과로 돌아가기' : '시작 화면으로'}</button>
        <div className="section-header"><div><p className="eyebrow">나의 도전 기록</p><h1 ref={heading} tabIndex={-1}>이 브라우저 순위</h1></div><span className="record-count">{ranked.length}개의 완료 기록</span></div>
        <p className="section-description">점수는 높을수록 위로, 같은 점수는 공동 순위로 기록됩니다.</p>
        <div className="ranking-toolbar"><label htmlFor="bank-version">문제 은행 버전 <select id="bank-version" value={version} onChange={e => setVersion(e.target.value)}>{versions.map(v => <option value={v} key={v}>v{v}{v === content.version ? ' (현재)' : ''}</option>)}</select></label><button className="text-button delete-link" onClick={() => setDeleteOpen(true)}>모든 완료 기록 삭제</button></div>
        <div className="ranking-table-wrap card">{ranked.length ? <table><caption className="sr-only">문제 은행 {version}의 완료 기록</caption><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">점수</th><th scope="col">완료 일시</th></tr></thead><tbody>{ranked.map(record => <tr key={record.id} className={record.id === completed?.id ? 'my-record' : ''}><td><span className={record.rank === 1 ? 'first-rank' : ''}>{record.rank}위</span></td><td>{record.nickname}{record.id === completed?.id && <span className="my-label">이번 기록</span>}</td><td><strong>{record.score}</strong><span className="muted">점</span></td><td><time dateTime={record.completedAt}>{dateText(record.completedAt)}</time></td></tr>)}</tbody></table> : <div className="empty-state"><span aria-hidden="true">◎</span><h2>첫 번째 기록을 남겨 보세요</h2><p>선택한 버전의 완료 기록이 아직 없습니다.</p><button className="button primary" onClick={reset}>시작 화면으로</button></div>}</div>
        <p className="ranking-note">공동 순위는 1위, 1위, 3위 방식입니다. 같은 점수에서는 완료 시각이 이른 기록부터 표시합니다.<br/>기록은 같은 브라우저·프로필·실행 주소에 저장되며, 브라우저 데이터를 삭제하면 사라집니다.</p>
      </section>}
    </main>
    <footer className="site-footer"><span>상식 한 바퀴</span><span>저장된 문제로만 출제 · 기록은 이 브라우저에</span></footer>
    {deleteOpen && <ConfirmDialog onCancel={() => setDeleteOpen(false)} onConfirm={() => { const result = deleteRecords(); refresh(); setDeleteOpen(false); setNotice(result.ok ? '이 브라우저의 완료 기록을 삭제했습니다.' : result.message); }}/ >}
  </div>;
}
