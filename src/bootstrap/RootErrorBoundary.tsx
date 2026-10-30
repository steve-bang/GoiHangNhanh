import { Component, type ReactNode } from 'react';

import { reportFatalRenderError, scrubErrorInPlace } from '@/platform';

interface Props {
  children: ReactNode;
  /** Test truyền hàm giả; mặc định chuyển cho handler lỗi JS toàn cục như lỗi fatal. */
  onFatal?: (error: unknown) => void;
}

interface State {
  failed: boolean;
}

/**
 * Boundary gốc (V1-16, sửa sau review PR #62). Không vẽ giao diện mới: có lỗi thì vẽ `null`. Không có nó,
 * React Native 0.88 đưa lỗi render THẲNG tới `ExceptionsManager.handleException(error, true)` (không qua
 * `ErrorUtils`), nên `error.message` gốc + componentStack thành thông điệp sập native mà Crashlytics bắt.
 *
 * - `getDerivedStateFromError` (pha render, TRƯỚC `onCaughtError` của React Native): lọc lỗi tại chỗ để
 *   báo không fatal của React Native (chỉ ra nhật ký native) cũng không mang thông điệp gốc.
 * - `componentDidCatch`: chuyển lỗi cho handler toàn cục như FATAL -> bộ lọc -> handler mặc định (bản
 *   release: app dừng như trước, thông điệp đã lọc; dev: LogBox). Không gửi componentStack.
 */
export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(error: unknown): State {
    scrubErrorInPlace(error);
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    (this.props.onFatal ?? reportFatalRenderError)(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
