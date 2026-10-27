// Public API của feature shop. Feature khác chỉ import từ đây (@/features/shop).
export * from './ui';
export type { Gateways } from './domain/types';
/** Chỉ cho test: đặt lại cổng mặc định (cổng giả giữ trạng thái trong bộ nhớ giữa các bài test). */
export { resetDefaultGatewaysForTests } from './data/gateways';
/** Thời gian màn Splash (UI-A01), để test điều hướng và chỉnh ở một nơi. */
export { SPLASH_MAX_WAIT_MS, SPLASH_MIN_VISIBLE_MS } from './domain/launch';
