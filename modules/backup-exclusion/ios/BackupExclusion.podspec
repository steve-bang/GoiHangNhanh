# Module Expo cục bộ của Đơn Chứng (V1-12, Q-24d): loại thư mục bằng chứng và CSDL khỏi iCloud Backup.
# Sàn iOS = sàn của ExpoModulesCore SDK 58 (không tự nâng, O-20). Khuôn theo podspec của các module Expo SDK 58; dùng được với `useFrameworks: "dynamic"` (app.json).
Pod::Spec.new do |s|
  s.name           = 'BackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Exclude app data directories from iCloud Backup'
  s.description    = 'Sets URLResourceValues.isExcludedFromBackup on app directories (local Expo module).'
  s.license        = 'UNLICENSED'
  s.author         = 'Don Chung'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
