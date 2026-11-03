#!/usr/bin/env bash
# Xóa các nhánh remote ĐÃ MERGE vào main (83 nhánh, chụp ngày 2026-11-03).
#
# Vì sao có script: phiên Claude Code trên cloud chặn `git push --delete` và ghi cài đặt repo (HTTP 403),
# nên nhánh đã merge chưa xóa được từ đó. Chạy script này trên máy có quyền push.
#
# Chỉ gồm nhánh có PR đã merge vào main, hoặc nhánh đã nằm trong lịch sử main. KHÔNG gồm (cần người xem trước):
#   - 5 nhánh PR đã merge nhưng còn commit ngoài main: claude/init-docs, feat/web-download-page,
#     feat/firebase-api-integration, feat/evidence-server-playback, feat/orders-list-detail
#   - 9 nhánh không có PR và chưa nằm trong main: claude/personal-tab-plan, claude/personal-tab-redesign,
#     claude/personal-tab-pr1-foundation ... pr4-shop, claude/personal-tab-screenshots,
#     claude/orders-tab-ui-screenshots, feat/app-icon
#   - 4 nhánh PR đóng không merge: claude/orders-tab-ui-pr1 ... pr4
#
# Dùng: ./scripts/git/delete-merged-branches.sh            (xóa thật)
#       DRY_RUN=1 ./scripts/git/delete-merged-branches.sh  (chỉ in ra)
# Lâu về sau nên bật Settings > General > "Automatically delete head branches" để không cần script này.
set -euo pipefail
branches=(
  "chore/app-icon"
  "claude/app-layout-shell"
  "claude/evidence-file-store"
  "claude/fix-other-source"
  "claude/hardening-pr1-firebase-session"
  "claude/hardening-pr3-sqlite-index"
  "claude/landing-home-design"
  "claude/landing-web-scaffold"
  "claude/onboarding-screens"
  "claude/orders-sync"
  "claude/orders-sync-wiring"
  "claude/orders-tab-ui"
  "claude/orders-tab-ui-pr5"
  "claude/pack-precheck"
  "claude/personal-hide-plan"
  "claude/personal-hide-plan-toggle"
  "claude/personal-tab-redesign-pr-a"
  "claude/personal-tab-redesign-pr-b"
  "claude/personal-tab-redesign-pr-c"
  "claude/personal-tab-redesign-pr-d"
  "claude/personal-tab-redesign-pr-e"
  "claude/personal-tab-redesign-pr-f"
  "claude/personal-tab-redesign-pr-g"
  "claude/personal-tab-redesign-pr-h"
  "claude/personal-tab-redesign-pr-i"
  "claude/personal-tab-ui-polish"
  "claude/platform-support-matrix"
  "claude/recorder-native"
  "claude/release-hardening-plan"
  "claude/setup-mobile-architecture"
  "claude/splash-screen"
  "claude/stability-baseline"
  "claude/test-timeout"
  "claude/ui-redesign-v2"
  "claude/upload-queue"
  "claude/upload-session"
  "claude/v1-00-screens-tooling"
  "claude/v1-01-env-guard"
  "claude/v1-02-network-retry"
  "claude/v1-03-auth-email-reset"
  "claude/v1-04-server-audit-rules"
  "claude/v1-05-personal-firebase"
  "claude/v1-06-session-guard"
  "claude/v1-07-uploader-identity"
  "claude/v1-07b-evidence-declarer-rules"
  "claude/v1-08-sync-center"
  "claude/v1-09-wifi-only"
  "claude/v1-10-home-real-data"
  "claude/v1-11-recording-hardening"
  "claude/v1-12-backup-exclusion-ios"
  "claude/v1-13-hash-efficiency"
  "claude/v1-14-account-delete-server"
  "claude/v1-15-account-delete-client"
  "claude/v1-16-crashlytics"
  "claude/v1-17-local-playback"
  "claude/v1-17b-returns-disputes-playback"
  "claude/v1-18-content-help-legal"
  "claude/v1-19-web-legal-pages"
  "claude/v1-20-store-listing-docs"
  "claude/v1-docs-claude-md-sync"
  "claude/v1-release-plan"
  "claude/verify-evidence"
  "claude/welcome-screen"
  "design-token"
  "docs/brand-story"
  "docs/ui-ux-audit"
  "feat/design-token-auth-onboarding"
  "feat/home-ux-redesign"
  "feat/personal-ux-redesign"
  "feat/quick-order-confirm-record"
  "feat/sign-in-screen"
  "feat/sign-up-screen"
  "feat/sync-ux-redesign"
  "feat/tab-bar-home-scan"
  "feat/v1-22-recorder-profile"
  "feat/v1-23-temp-file-safety"
  "feat/v1-27-capture-metrics"
  "feat/v1-28-pause-upload-while-recording"
  "feat/web-app-screenshots"
  "feat/web-brand-tokens"
  "feat/web-ci-content-faq"
  "feat/web-guides"
  "fix/ios-build-donchungdev-mic"
)
for b in "${branches[@]}"; do
  if [[ -n "${DRY_RUN:-}" ]]; then
    echo "[dry-run] git push origin --delete $b"
  else
    git push origin --delete "$b" || echo "BỎ QUA: $b"
  fi
done
