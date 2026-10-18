import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { bank, drawQuestions, inspectBank } from './logic/content';
import rawBank from './data/question-bank.json';
import { loadRecords, RECORD_PREFIX, saveRecord } from './logic/records';
import { completionFromGame, createGame, gameReducer } from './logic/game';

const escaped = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
async function start(name = '태민') { const user = userEvent.setup(); await user.type(screen.getByLabelText('닉네임'), name); await user.click(screen.getByRole('button', { name: /퀴즈 시작하기/ })); return user; }
describe('실제 콘텐츠를 사용하는 화면 동작 (jsdom)', () => {
  it('시작 설명·분야별 수·닉네임 검사를 표시한다', async () => {
    render(<App/>); expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('아는 만큼'); expect(screen.getAllByText('50문제 중 3문제 출제')).toHaveLength(4);
    const user = userEvent.setup(); const button = screen.getByRole('button', { name: /퀴즈 시작하기/ }); expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('닉네임'), '태 민'); expect(screen.getByLabelText('닉네임')).toHaveValue('태민');
    await user.clear(screen.getByLabelText('닉네임')); await user.type(screen.getByLabelText('닉네임'), '가'.repeat(13)); expect(button).toBeDisabled();
  });
  it('선택 전 제출을 막고 정답·검수 해설·연결된 출처를 표시한다', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); const q = drawQuestions(bank, () => 0)[0];
    render(<App/>); const user = await start(); const submit = screen.getByRole('button', { name: /답 제출하기/ }); expect(submit).toBeDisabled();
    const answer = q.options.find(o => o.id === q.correctOptionId)!;
    await user.click(screen.getByRole('radio', { name: escaped(answer.text) })); await user.dblClick(submit);
    const status = screen.getByRole('status'); expect(status).toHaveTextContent('정답입니다'); expect(status).toHaveTextContent(q.explanation);
    expect(within(status).getByRole('link', { name: escaped(q.sources[0].institution) })).toHaveAttribute('href', q.sources[0].url);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled(); expect(screen.getByText('10', { selector: '.current-score strong' })).toBeInTheDocument();
  });
  it('키보드로 보기 선택·제출·다음 문제 진행', async () => {
    render(<App/>); const user = await start(); await user.tab(); expect(screen.getAllByRole('radio')[0]).toHaveFocus();
    await user.keyboard(' '); await user.tab(); expect(screen.getByRole('button', { name: /답 제출하기/ })).toHaveFocus(); await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveFocus(); await user.tab();
    // 출처 링크를 지나 다음 버튼까지 키보드 이동.
    for (let i = 0; i < 5 && document.activeElement !== screen.getByRole('button', { name: /다음 문제/ }); i++) await user.tab();
    expect(screen.getByRole('button', { name: /다음 문제/ })).toHaveFocus(); await user.keyboard('{Enter}'); expect(document.querySelector('.progress-caption strong')).toHaveTextContent('2'); expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
  it('12문제 정답7개 → 70점·분야결과·순위·재시작·재마운트 후 기록 유지', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); const qs = drawQuestions(bank, () => 0);
    const rendered = render(<App/>); const user = await start('<b>태민</b>');
    for (let i = 0; i < 12; i++) {
      const q = qs[i]; expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(q.question);
      const option = q.options.find(o => i < 7 ? o.id === q.correctOptionId : o.id !== q.correctOptionId)!;
      await user.click(screen.getByRole('radio', { name: escaped(option.text) })); await user.click(screen.getByRole('button', { name: /답 제출하기/ }));
      expect(screen.getByRole('status')).toHaveTextContent(i < 7 ? '정답입니다' : '아쉬워요');
      if (i < 11) expect(loadRecords().records).toHaveLength(0);
      await user.click(screen.getByRole('button', { name: i === 11 ? /결과 보기/ : /다음 문제/ }));
    }
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('<b>태민</b>님의 결과');
    expect(screen.getByText('70', { selector: '.result-score strong' })).toBeInTheDocument();
    await waitFor(() => expect(loadRecords().records).toHaveLength(1));
    expect(screen.getByText('1위', { selector: '.result-rank strong' })).toBeInTheDocument();
    expect(document.querySelector('h1 b')).toBeNull();
    await user.click(screen.getByRole('button', { name: '전체 순위 보기' })); await user.click(screen.getByRole('button', { name: /결과로 돌아가기/ })); expect(loadRecords().records).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /다시 하기/ })); expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('아는 만큼');
    rendered.unmount(); render(<App/>); await user.click(screen.getByRole('button', { name: /이 브라우저 순위 보기/ })); expect(screen.getByRole('table')).toHaveTextContent('<b>태민</b>'); expect(loadRecords().records).toHaveLength(1);
  });
  it('미완료 게임 재마운트 시 초기화되고 순위에는 등록되지 않는다', async () => { const view = render(<App/>); await start(); view.unmount(); render(<App/>); expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('아는 만큼'); expect(loadRecords().records).toHaveLength(0); });
  it('완료 시 저장 실패를 표시하고 같은 ID로 재시도해 한 번만 저장한다', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); const qs = drawQuestions(bank, () => 0);
    render(<App/>); const user = await start();
    for (let i = 0; i < 12; i++) {
      const q = qs[i]; const wrong = q.options.find(o => o.id !== q.correctOptionId)!;
      await user.click(screen.getByRole('radio', { name: escaped(wrong.text) })); await user.click(screen.getByRole('button', { name: /답 제출하기/ }));
      if (i < 11) await user.click(screen.getByRole('button', { name: /다음 문제/ }));
    }
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    await user.click(screen.getByRole('button', { name: /결과 보기/ }));
    expect(screen.getByText('저장 실패 · 순위 미등록')).toBeInTheDocument(); expect(screen.queryByText('✓ 완료 기록을 이 브라우저에 저장했습니다.')).not.toBeInTheDocument(); expect(loadRecords().records).toHaveLength(0);
    failure.mockRestore(); await user.click(screen.getByRole('button', { name: '기록 저장 다시 시도' })); expect(loadRecords().records).toHaveLength(1); expect(screen.getByText('✓ 완료 기록을 이 브라우저에 저장했습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전체 순위 보기' })); expect(screen.getByRole('table')).toHaveTextContent('0점');
  });
  it('손상 데이터 안내·삭제 취소·Escape·확인 삭제를 처리한다', async () => {
    localStorage.setItem(RECORD_PREFIX + 'broken', '{broken'); localStorage.setItem('other-app', 'keep'); render(<App/>);
    expect(screen.getByLabelText('기록 저장소 안내')).toHaveTextContent('손상'); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /이 브라우저 순위 보기/ }));
    await user.click(screen.getByRole('button', { name: '모든 완료 기록 삭제' })); let dialog = screen.getByRole('dialog'); expect(within(dialog).getByRole('button', { name: '취소' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: '취소' })); expect(localStorage.getItem(RECORD_PREFIX + 'broken')).toBe('{broken');
    await user.click(screen.getByRole('button', { name: '모든 완료 기록 삭제' })); await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '모든 완료 기록 삭제' })); dialog = screen.getByRole('dialog'); await user.click(within(dialog).getByRole('button', { name: '모든 기록 삭제' }));
    expect(localStorage.getItem(RECORD_PREFIX + 'broken')).toBeNull(); expect(localStorage.getItem('other-app')).toBe('keep');
  });
  it('문제 부족을 알리고 시작을 막는다', () => { const raw = structuredClone(rawBank); raw.questions = raw.questions.filter(q => q.category !== '과학'); render(<App content={inspectBank(raw)}/>); expect(screen.getByText(/과학: 검증 완료 문제가 0개/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: /퀴즈 시작하기/ })).toBeDisabled(); });
  it('저장 접근 실패가 게임 화면 전체를 중단시키지 않는다', () => { vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); }); localStorage.setItem(RECORD_PREFIX + 'a', 'some'); render(<App/>); expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); expect(screen.getByLabelText('기록 저장소 안내')).toBeInTheDocument(); });
  it('다른 문제 은행 버전의 기록을 선택해 볼 수 있다', async () => {
    let game = createGame('old-id', '이전기록', '0.9.0', drawQuestions());
    for (const q of game.questions) { game = gameReducer(game, { type: 'select', questionId: q.id, optionId: q.correctOptionId }); game = gameReducer(game, { type: 'submit', questionId: q.id }); game = gameReducer(game, { type: 'next', questionId: q.id, now: '2026-10-17T08:00:00Z' }); }
    saveRecord(completionFromGame(game)); render(<App/>); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: /이 브라우저 순위 보기/ })); expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('문제 은행 버전'), { target: { value: '0.9.0' } }); expect(screen.getByRole('table')).toHaveTextContent('이전기록');
  });
});
