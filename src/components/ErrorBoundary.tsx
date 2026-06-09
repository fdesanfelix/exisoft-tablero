import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; info: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ error, info: info.componentStack || '' });
  }

  reset = () => this.setState({ error: null, info: '' });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 28, maxWidth: 900, margin: '40px auto', background: '#fff', border: '2px solid #c0392b', borderRadius: 14 }}>
        <h2 style={{ color: '#c0392b', marginBottom: 12 }}>Algo se rompió 💥</h2>
        <p style={{ marginBottom: 14, color: '#5a5a5b' }}>
          La interfaz capturó un error. Esto evita la pantalla en blanco. Mostralo si necesitás reportarlo:
        </p>
        <pre style={{ background: '#fdecea', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#c0392b', whiteSpace: 'pre-wrap' }}>
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
        </pre>
        {this.state.info && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#8a8a8b' }}>Stack de componentes</summary>
            <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 11, color: '#5a5a5b', whiteSpace: 'pre-wrap' }}>
{this.state.info}
            </pre>
          </details>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={this.reset} style={{ padding: '8px 16px', borderRadius: 999, border: '1.5px solid #e5e5e5', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Reintentar
          </button>
          <button onClick={() => { localStorage.clear(); location.reload(); }}
            style={{ padding: '8px 16px', borderRadius: 999, border: 'none', background: '#EB7221', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Resetear datos y recargar
          </button>
        </div>
      </div>
    );
  }
}
