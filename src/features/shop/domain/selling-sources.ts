import type { OrderSource } from '@/core/orders/order-source';
import { normalizeSources, SELLING_SOURCES } from '@/core/orders/selling-sources';

export { normalizeSources, SELLING_SOURCES };

export function toggleSource(selected: readonly OrderSource[], source: OrderSource): OrderSource[] {
  return normalizeSources(
    selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source],
  );
}
