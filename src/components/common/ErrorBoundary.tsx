import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          background: 'hsla(var(--danger), 0.05)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid hsla(var(--danger), 0.2)',
          margin: '2rem auto',
          maxWidth: '500px'
        }}>
          <AlertTriangle size={48} color="hsl(var(--danger))" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Oups ! Une erreur est survenue</h3>
          <p style={{ color: 'hsl(var(--text-muted))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            La page a rencontré un problème inattendu.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
            style={{ gap: '0.5rem' }}
          >
            <RefreshCcw size={18} /> Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
