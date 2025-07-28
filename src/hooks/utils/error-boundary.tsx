/**
 * 🛡️ ERROR BOUNDARY UTILITIES
 * 
 * Utilitários para criar error boundaries que lidam graciosamente com erros
 * de realtime, fornecendo fallbacks e recuperação automática.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  RealtimeError,
  RealtimeErrorType,
  ErrorSeverity,
  ErrorBoundaryConfig,
  ErrorBoundaryState
} from '../types/error-types';
import { ErrorClassifier } from './error-classifier';
import { errorRecoveryManager } from './error-recovery';

// 🎯 PROPS DO ERROR BOUNDARY
export interface RealtimeErrorBoundaryProps extends ErrorBoundaryConfig {
  children: ReactNode;
  fallback?: ReactNode | ((error: RealtimeError, retry: () => void) => ReactNode);
  onError?: (error: RealtimeError, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean; // Se true, não propaga erro para boundaries pai
}

// 🎯 COMPONENTE FALLBACK PADRÃO
const DefaultErrorFallback: React.FC<{
  error: RealtimeError;
  retry: () => void;
  canRetry: boolean;
}> = ({ error, retry, canRetry }) => {
  const friendlyMessage = ErrorClassifier.getFriendlyMessage(error);
  const isTemporary = error.retryable && error.severity !== ErrorSeverity.CRITICAL;

  return (
    <div className="realtime-error-boundary">
      <div className="error-content">
        <div className="error-icon">
          {error.severity === ErrorSeverity.CRITICAL ? '🚨' : '⚠️'}
        </div>
        
        <div className="error-message">
          <h3>
            {error.severity === ErrorSeverity.CRITICAL 
              ? 'Erro Crítico' 
              : 'Problema Temporário'
            }
          </h3>
          <p>{friendlyMessage}</p>
        </div>

        {canRetry && isTemporary && (
          <div className="error-actions">
            <button 
              onClick={retry}
              className="retry-button"
              type="button"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Detalhes Técnicos</summary>
            <pre>{JSON.stringify(ErrorClassifier.createErrorSummary(error), null, 2)}</pre>
          </details>
        )}
      </div>

      <style jsx>{`
        .realtime-error-boundary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          margin: 1rem 0;
        }

        .error-content {
          text-align: center;
          max-width: 400px;
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-message h3 {
          color: #dc2626;
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }

        .error-message p {
          color: #7f1d1d;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        .retry-button {
          background-color: #dc2626;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .retry-button:hover {
          background-color: #b91c1c;
        }

        .error-details {
          margin-top: 1.5rem;
          text-align: left;
        }

        .error-details summary {
          cursor: pointer;
          color: #7f1d1d;
          font-weight: 500;
        }

        .error-details pre {
          background-color: #f3f4f6;
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
};

/**
 * 🎯 ERROR BOUNDARY PARA HOOKS REALTIME
 */
export class RealtimeErrorBoundary extends Component<
  RealtimeErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: RealtimeErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: null,
      isDisabled: false,
      retryCount: 0
    };

    this.maxRetries = props.maxErrorsBeforeDisable || 3;
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Classificar o erro
    const realtimeError = ErrorClassifier.classify(error, {
      operation: 'component_render',
      timestamp: Date.now()
    });

    return {
      hasError: true,
      error: realtimeError,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const realtimeError = this.state.error || ErrorClassifier.classify(error, {
      operation: 'component_render',
      timestamp: Date.now()
    });

    // Atualizar contadores
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1,
      retryCount: prevState.retryCount + 1,
      isDisabled: (prevState.errorCount + 1) >= this.maxRetries
    }));

    // Callback de erro
    if (this.props.onError) {
      try {
        this.props.onError(realtimeError, errorInfo);
      } catch (callbackError) {
        console.error('[RealtimeErrorBoundary] Erro no callback onError:', callbackError);
      }
    }

    // Logging
    if (this.props.enableLogging !== false) {
      console.error('[RealtimeErrorBoundary] Erro capturado:', {
        error: ErrorClassifier.createErrorSummary(realtimeError),
        errorInfo,
        componentStack: errorInfo.componentStack
      });
    }

    // Tentar recuperação automática para erros não críticos
    if (realtimeError.retryable && !ErrorClassifier.isCritical(realtimeError)) {
      this.scheduleAutoRecovery(realtimeError);
    }
  }

  componentDidUpdate(prevProps: RealtimeErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset baseado em mudança de props
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }

    // Reset baseado em resetKeys
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys![index]
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  /**
   * Agenda recuperação automática
   */
  private scheduleAutoRecovery = (error: RealtimeError) => {
    if (this.state.isDisabled || this.retryCount >= this.maxRetries) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30s

    this.resetTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  /**
   * Manipula retry manual ou automático
   */
  private handleRetry = async () => {
    const { error } = this.state;

    if (!error || this.state.isDisabled) {
      return;
    }

    try {
      // Tentar recuperação usando o recovery manager
      const result = await errorRecoveryManager.recover(error);

      if (result.success) {
        this.resetErrorBoundary();
      } else {
        // Incrementar contador de retry
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
          this.setState({ isDisabled: true });
        } else {
          // Agendar próxima tentativa
          this.scheduleAutoRecovery(error);
        }
      }
    } catch (recoveryError) {
      console.error('[RealtimeErrorBoundary] Erro na recuperação:', recoveryError);
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        this.setState({ isDisabled: true });
      }
    }
  };

  /**
   * Reset do error boundary
   */
  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.retryCount = 0;

    this.setState({
      hasError: false,
      error: null,
      lastErrorTime: null,
      isDisabled: false,
      retryCount: 0
    });
  };

  render() {
    const { hasError, error, isDisabled } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Verificar se deve isolar o erro
      if (this.props.isolate && !ErrorClassifier.isCritical(error)) {
        // Para erros não críticos isolados, renderizar fallback sem propagar
      } else if (ErrorClassifier.isCritical(error)) {
        // Para erros críticos, sempre propagar
        throw error;
      }

      // Renderizar fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.handleRetry);
      }

      if (fallback) {
        return fallback;
      }

      // Fallback padrão
      return (
        <DefaultErrorFallback
          error={error}
          retry={this.handleRetry}
          canRetry={!isDisabled && error.retryable}
        />
      );
    }

    return children;
  }
}

/**
 * 🎯 HOC PARA ADICIONAR ERROR BOUNDARY
 */
export function withRealtimeErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<RealtimeErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <RealtimeErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </RealtimeErrorBoundary>
  );

  WrappedComponent.displayName = `withRealtimeErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * 🎯 HOOK PARA USAR ERROR BOUNDARY PROGRAMATICAMENTE
 */
export function useRealtimeErrorBoundary() {
  const [error, setError] = React.useState<RealtimeError | null>(null);

  const captureError = React.useCallback((error: Error | RealtimeError) => {
    const realtimeError = 'type' in error 
      ? error as RealtimeError
      : ErrorClassifier.classify(error, {
          operation: 'hook_error',
          timestamp: Date.now()
        });

    setError(realtimeError);

    // Se for erro crítico, propagar
    if (ErrorClassifier.isCritical(realtimeError)) {
      throw realtimeError;
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const retry = React.useCallback(async () => {
    if (!error) return;

    try {
      const result = await errorRecoveryManager.recover(error);
      if (result.success) {
        clearError();
      }
    } catch (recoveryError) {
      console.error('[useRealtimeErrorBoundary] Erro na recuperação:', recoveryError);
    }
  }, [error, clearError]);

  return {
    error,
    hasError: error !== null,
    captureError,
    clearError,
    retry
  };
}

/**
 * 🎯 UTILITÁRIO PARA CRIAR ERROR BOUNDARY CUSTOMIZADO
 */
export function createRealtimeErrorBoundary(
  config: Partial<RealtimeErrorBoundaryProps> = {}
) {
  return function RealtimeErrorBoundaryWrapper({ children }: { children: ReactNode }) {
    return (
      <RealtimeErrorBoundary {...config}>
        {children}
      </RealtimeErrorBoundary>
    );
  };
}