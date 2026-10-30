import ExpoModulesCore
import Foundation

// Đơn Chứng V1-12 (Q-24d A): loại thư mục bằng chứng (`Documents/evidence`) và CSDL cục bộ
// (`Documents/SQLite`) khỏi iCloud Backup / sao lưu máy tính. Đặt thuộc tính lên THƯ MỤC: Apple áp cho
// cả nội dung bên trong, kể cả tệp tạo sau. Chỉ đặt thuộc tính, không đọc/ghi/xóa tệp. Không ném lỗi
// sang JS: trả mã kết quả để adapter (`src/platform/backup-exclusion.ts`) ghi log không đường dẫn.
// Apple coi cờ là gợi ý; kiểm chứng trên máy bằng dung lượng sao lưu của app (release-checklist G-7).
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DonChungBackupExclusion")

    // `path`: URI `file://...` (expo-file-system) hoặc đường dẫn tuyệt đối (expo-sqlite).
    // Trả "excluded" | "not_found" | "failed".
    AsyncFunction("excludeFromBackup") { (path: String) -> String in
      guard var url = BackupExclusionModule.fileURL(from: path) else {
        return "failed"
      }
      guard FileManager.default.fileExists(atPath: url.path) else {
        return "not_found"
      }
      do {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
        // Đọc lại từ đĩa (bỏ bộ nhớ đệm của URL) để chỉ báo "excluded" khi thuộc tính đã thật sự đặt.
        url.removeAllCachedResourceValues()
        let check = try url.resourceValues(forKeys: [.isExcludedFromBackupKey])
        return check.isExcludedFromBackup == true ? "excluded" : "failed"
      } catch {
        return "failed"
      }
    }
  }

  private static func fileURL(from path: String) -> URL? {
    if path.hasPrefix("file://") {
      guard let url = URL(string: path), url.isFileURL else { return nil }
      return url
    }
    guard path.hasPrefix("/") else { return nil }
    return URL(fileURLWithPath: path, isDirectory: true)
  }
}
