// Public API của feature shop. Feature khác chỉ import từ đây (@/features/shop).
export * from './ui';
export type { Gateways } from './domain/types';
/** Chỉ cho test: đặt lại cổng mặc định (cổng giả giữ trạng thái trong bộ nhớ giữa các bài test). */
export { resetDefaultGatewaysForTests } from './data/gateways';
