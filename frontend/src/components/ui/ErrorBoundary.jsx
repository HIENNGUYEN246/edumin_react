import React from 'react';

/**
 * Universal Error Boundary component to prevent React runtime unmounting (White Screen).
 * Catches render errors and displays a friendly recovery UI.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[EduMin ErrorBoundary] Caught unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[360px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200/90 shadow-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-2xs">
              <i className="fas fa-triangle-exclamation" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {this.props.title || 'Đã có lỗi xảy ra khi hiển thị nội dung'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {this.props.message ||
                  'Hệ thống gặp sự cố khi xử lý dữ liệu của trang này. Bạn có thể tải lại trang hoặc quay lại màn hình trước.'}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] font-mono text-rose-700 max-h-28 overflow-y-auto custom-scrollbar break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fas fa-rotate-right" />
                <span>Tải lại trang</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoBack}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <i className="fas fa-arrow-left" />
                <span>Quay lại</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

