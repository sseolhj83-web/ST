/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render/lifecycle exceptions inside the 3D game view (Three.js scene setup,
// teardown on unmount, etc.) so a crash there degrades to a recoverable screen
// instead of silently unmounting the whole React tree to a blank page.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Game view crashed:', error, info.componentStack);
  }

  handleReturn = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-slate-950 text-white p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <p className="text-lg font-bold">게임 화면에서 오류가 발생했습니다</p>
          <p className="text-slate-400 text-sm max-w-md break-words">{this.state.error.message}</p>
          <button
            onClick={this.handleReturn}
            className="flex items-center gap-1.5 px-5 py-2.5 border border-white/10 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl text-sm font-bold uppercase transition-all tracking-wider font-mono cursor-pointer mt-2"
          >
            <RotateCcw className="w-4 h-4" />
            로비로 돌아가기
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
