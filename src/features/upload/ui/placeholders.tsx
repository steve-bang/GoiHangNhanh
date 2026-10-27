import { PlaceholderScreen } from '@/shared/ui';

/** Màn khung của upload: lưu và đồng bộ (UI-C05), chi tiết lỗi đồng bộ (UI-F02), dung lượng (UI-F03). */
export const PackSavedScreen = () => <PlaceholderScreen uiCode="UI-C05" />;
export const SyncErrorScreen = () => <PlaceholderScreen uiCode="UI-F02" inTabs />;
export const StorageScreen = () => <PlaceholderScreen uiCode="UI-F03" inTabs />;
