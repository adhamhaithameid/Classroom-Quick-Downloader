// filepath: extension/entrypoints/popup/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const GITHUB_ISSUES_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSf-2jzXudj59KSnn5Ht0Ba_eiEqCqJ6h5Nl4YXt8RWcYVp_9w/viewform?pli=1';

/**
 * Error Boundary component matching extension UI style.
 * Catches React rendering errors and displays a fallback UI.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReportError = (): void => {
    const { error, errorInfo } = this.state;
    
    // Create GitHub issue URL with pre-filled error details
    const title = encodeURIComponent(`[Bug] Extension Error: ${error?.message || 'Unknown error'}`);
    const body = encodeURIComponent(
      `## Error Description\n\nThe extension encountered an unexpected error.\n\n` +
      `**Error Message:** ${error?.toString() || 'Unknown'}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${error?.stack || 'Not available'}\n\`\`\`\n\n` +
      `${errorInfo ? `**Component Stack:**\n\`\`\`\n${errorInfo.componentStack}\n\`\`\`\n\n` : ''}` +
      `## Steps to Reproduce\n\n1. [Please describe what you were doing when this error occurred]\n2. \n3. \n\n` +
      `## Additional Context\n\n- Browser: ${navigator.userAgent}\n- Timestamp: ${new Date().toISOString()}`
    );
    
    window.open(`${GITHUB_ISSUES_URL}?title=${title}&body=${body}`, '_blank');
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="cqd-container" style={{ 
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="cqd-panel" style={{ maxWidth: '100%', width: '100%' }}>
            <div className="cqd-card" style={{
              textAlign: 'center',
              padding: '32px 24px'
            }}>
              <div style={{
                fontSize: '56px',
                marginBottom: '16px',
                lineHeight: 1
              }}>
                😕
              </div>
              
              <h2 className="cqd-card-title" style={{
                fontSize: '20px',
                fontWeight: 600,
                margin: '0 0 8px 0',
                color: 'var(--cqd-text-primary, #1a1a1a)'
              }}>
                Oops! Something went wrong
              </h2>
              
              <p style={{
                margin: '0 0 24px 0',
                fontSize: '14px',
                color: 'var(--cqd-text-secondary, #666)',
                lineHeight: 1.5
              }}>
                The extension encountered an unexpected error.<br/>
                
              </p>

              <div style={{
                display: 'flex',
                gap: '12px',
                flexDirection: 'column',
                alignItems: 'stretch'
              }}>
                <button
                  className="cqd-button cqd-button-primary"
                  onClick={this.handleReportError}
                  style={{
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  <span>Report Error on GitHub</span>
                </button>
                
                <button
                  className="cqd-button cqd-button-ghost"
                  onClick={this.handleReload}
                  style={{
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  <span>Reload Extension</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
