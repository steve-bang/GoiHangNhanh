/**
 * Mock cho `@/platform/keep-awake` (gắn toàn cục ở `jest.setup.ts`; test của adapter dùng `jest.unmock`).
 * Ghi lại lần bật/tắt theo tag để test kiểm "đúng pha, đúng một lần".
 *
 *   import { mockKeepAwake } from '@/test-utils/mock-keep-awake';
 *   expect(mockKeepAwake.activeCount()).toBe(1);
 */
import { useEffect, useId } from 'react';

export const mockKeepAwake = {
  activations: 0,
  deactivations: 0,
  active: new Set<string>(),
  /** Số tag đang giữ sáng. */
  activeCount(): number {
    return mockKeepAwake.active.size;
  },
};

export function resetMockKeepAwake(): void {
  mockKeepAwake.activations = 0;
  mockKeepAwake.deactivations = 0;
  mockKeepAwake.active.clear();
}

export const keepAwakeMock = {
  useKeepScreenAwake(active: boolean): void {
    const tag = useId();
    useEffect(() => {
      if (!active) return undefined;
      mockKeepAwake.activations += 1;
      mockKeepAwake.active.add(tag);
      return () => {
        mockKeepAwake.deactivations += 1;
        mockKeepAwake.active.delete(tag);
      };
    }, [active, tag]);
  },
};
