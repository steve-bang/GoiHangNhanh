import { Share } from 'react-native';

/** Mở bảng chia sẻ của hệ điều hành với một đoạn văn bản. Không ném lỗi: hủy hoặc lỗi trả `false`. */
export async function shareText(message: string): Promise<boolean> {
  try {
    const result = await Share.share({ message });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
