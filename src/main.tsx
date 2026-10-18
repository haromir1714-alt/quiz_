import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="fatal-error"><h1>화면을 불러오지 못했습니다</h1><p>문제 파일이나 앱 파일을 확인해 주세요. 저장된 기록은 자동 삭제하지 않았습니다.</p><button onClick={() => window.location.reload()}>다시 불러오기</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App/></ErrorBoundary></StrictMode>);
