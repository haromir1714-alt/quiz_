import { useEffect, useRef } from 'react';
export function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="modal-backdrop"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" ref={box} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    if (event.key === 'Tab') {
      const buttons = box.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <span className="dialog-symbol" aria-hidden="true">!</span>
    <h2 id="delete-title">완료 기록을 모두 삭제할까요?</h2>
    <p id="delete-description">이 브라우저의 모든 문제 은행 버전 기록이 삭제됩니다. 삭제한 기록은 되돌릴 수 없습니다.</p>
    <div className="button-row"><button className="button secondary" onClick={onCancel}>취소</button><button className="button danger" onClick={onConfirm}>모든 기록 삭제</button></div>
  </div></div>;
}
