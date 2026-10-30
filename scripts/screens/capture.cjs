'use strict';
/**
 * Chụp ảnh màn hình bản web (react-native-web, cổng giả) cho mô tả PR - kế hoạch v1 mục 4.
 *
 *   node scripts/screens/capture.cjs --work <thư mục ngoài repo> --out <thư mục ảnh> \
 *     --routes "/=01-home,/account=02-account" [--session signed_in] [--sizes 390x844|all]
 *
 * Các bước: sao mã nguồn (cây làm việc gồm tệp chưa commit, hoặc `--source <git-ref>`) vào
 * `<work>/repo`, chép `node_modules` của repo (thật, không hardlink), `npm i --no-save` hai gói web
 * (không đổi package.json/lockfile của repo), `expo export --platform web` với cổng giả cho từng
 * phiên giả, phục vụ tĩnh ở 127.0.0.1:<port> và chụp bằng Playwright (shoot.cjs).
 * Không chạy trong `npm run check`/CI (Playwright không có ở đó). Chi tiết: scripts/screens/README.md.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  DEFAULT_PORT,
  DEFAULT_SCALE,
  DEFAULT_WAIT_MS,
  SESSIONS,
  WEB_PACKAGES,
  WORK_MARKER,
  assertGitRef,
  assertUniqueNames,
  checkWorkDir,
  exportEnv,
  parseArgs,
  parseEnvPairs,
  parseRoutes,
  parseRoutesFile,
  parseSizes,
} = require('./lib.cjs');
const { startStaticServer } = require('./serve.cjs');
const { loadPlaywright, reportResult, shoot } = require('./shoot.cjs');

const REPO_ROOT = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const MARKER = '.doncung-screens-marker';

const HELP = `Chụp ảnh bản web (cổng giả). Cách dùng: scripts/screens/README.md

  --routes "<route>[=<tên>],..."   route cần chụp (bắt buộc nếu không có --routes-file)
  --routes-file <tệp.json>         [{ "route", "name"?, "session"?, "waitFor"?, "waitMs"?, "fullPage"? }]
  --out <thư mục>                  nơi ghi ảnh (mặc định <work>/shots)
  --work <thư mục>                 thư mục làm việc NGOÀI repo (mặc định ${path.join(os.tmpdir(), 'doncung-screens')})
  --session ${SESSIONS.join('|')}   phiên giả mặc định (mặc định signed_in)
  --sizes 390x844[,360x800]|all     cỡ khung nhìn (mặc định 390x844; all = 320x568,360x800,390x844)
  --scale <n>                      hệ số điểm ảnh (mặc định ${DEFAULT_SCALE})
  --wait-for <selector>            chờ selector Playwright trước khi chụp (ví dụ "text=Đơn hàng")
  --wait-ms <ms>                   chờ thêm trước khi chụp (mặc định ${DEFAULT_WAIT_MS})
  --full-page                      chụp cả trang cuộn
  --port <n>                       cổng phục vụ tĩnh (mặc định ${DEFAULT_PORT})
  --source worktree|<git-ref>      mã đem xuất (mặc định worktree: gồm thay đổi chưa commit)
  --env EXPO_PUBLIC_X=giá-trị      thêm biến lúc xuất (lặp được)
  --skip-export                    dùng lại bản xuất trước trong <work>/dist-<phiên>
  --allow-page-errors              không coi lỗi trang là thất bại`;

function log(s) {
  process.stdout.write(`${s}\n`);
}

function run(cmd, args, options = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Lệnh thất bại (mã ${res.status}): ${cmd} ${args[0]}`);
}

function readDirOrNull(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Xóa mọi thứ trong `dir` trừ `keep` (chỉ gọi sau `checkWorkDir`). */
function emptyDirExcept(dir, keep) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    if (name !== keep) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

function copyWorktree(dest) {
  const res = spawnSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error('git ls-files thất bại');
  const files = res.stdout.toString().split('\0').filter(Boolean);
  let copied = 0;
  for (const rel of files) {
    if (rel === 'node_modules' || rel.startsWith('node_modules/')) continue;
    const src = path.join(REPO_ROOT, rel);
    let stat;
    try {
      stat = fs.lstatSync(src);
    } catch {
      continue; // tệp đã xóa trong cây làm việc
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) continue;
    const dst = path.join(dest, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { verbatimSymlinks: true });
    copied += 1;
  }
  log(`Đã sao ${copied} tệp từ cây làm việc.`);
}

function copyGitRef(ref, dest) {
  assertGitRef(ref);
  const archive = spawnSync('git', ['archive', '--format=tar', '--end-of-options', ref], {
    cwd: REPO_ROOT,
    maxBuffer: 2 * 1024 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new Error(`git archive ${ref} thất bại`);
  const tar = spawnSync('tar', ['-x', '-C', dest], { input: archive.stdout });
  if (tar.status !== 0) throw new Error('Giải nén mã nguồn thất bại');
  log(`Đã sao mã nguồn tại ${ref}.`);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * `node_modules` của bản sao: chép thật từ repo (npm sẽ ghi vào nên không dùng hardlink/symlink),
 * thêm hai gói web bằng `npm i --no-save`. Dùng lại khi lockfile và danh sách gói không đổi.
 */
function ensureNodeModules(repoDir) {
  const lock = path.join(repoDir, 'package-lock.json');
  const want = `${sha256File(lock)} ${WEB_PACKAGES.join(' ')}`;
  const modules = path.join(repoDir, 'node_modules');
  const markerFile = path.join(modules, MARKER);
  if (fs.existsSync(markerFile) && fs.readFileSync(markerFile, 'utf8') === want) {
    log('Dùng lại node_modules của bản sao (lockfile không đổi).');
    return;
  }
  fs.rmSync(modules, { recursive: true, force: true });
  const repoModules = path.join(REPO_ROOT, 'node_modules');
  if (fs.existsSync(repoModules)) {
    log('Chép node_modules của repo (lần đầu, có thể mất vài phút)...');
    if (process.platform === 'win32') {
      fs.cpSync(repoModules, modules, { recursive: true, verbatimSymlinks: true });
    } else {
      run('cp', ['-a', repoModules, modules]);
    }
  } else {
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: repoDir });
  }
  run('npm', ['i', '--no-save', '--no-audit', '--no-fund', ...WEB_PACKAGES], { cwd: repoDir });
  fs.writeFileSync(markerFile, want);
}

function exportWeb(repoDir, distDir, session, extraEnv) {
  fs.rmSync(distDir, { recursive: true, force: true });
  run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', distDir, '--clear'], {
    cwd: repoDir,
    env: exportEnv(process.env, session, extraEnv),
  });
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Bản xuất web không có index.html: ${distDir}`);
  }
}

function readEntries(opts) {
  const defaults = {
    session: opts.session ?? 'signed_in',
    waitMs: opts.waitMs === undefined ? DEFAULT_WAIT_MS : Number(opts.waitMs),
    waitFor: opts.waitFor,
    fullPage: Boolean(opts.fullPage),
  };
  if (opts.routesFile) {
    return parseRoutesFile(fs.readFileSync(path.resolve(opts.routesFile), 'utf8'), defaults);
  }
  if (opts.routes) return parseRoutes(opts.routes, defaults);
  throw new Error('Cần --routes hoặc --routes-file (xem --help)');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    log(HELP);
    return;
  }
  const entries = readEntries(opts);
  assertUniqueNames(entries);
  parseSizes(opts.sizes); // kiểm tra sớm, trước khi xuất
  const extraEnv = parseEnvPairs(opts.env);
  const source = opts.source ?? 'worktree';
  if (source !== 'worktree') assertGitRef(source); // trước mọi thao tác trên đĩa
  const work = path.resolve(opts.work ?? path.join(os.tmpdir(), 'doncung-screens'));
  // Đường dẫn thật (bỏ symlink) để không lách được kiểm tra bằng liên kết tới repo/thư mục cha.
  const workReal = fs.existsSync(work) ? fs.realpathSync(work) : work;
  const workState = checkWorkDir(workReal, REPO_ROOT, readDirOrNull(work));
  const out = path.resolve(opts.out ?? path.join(work, 'shots'));
  const port = opts.port ? Number(opts.port) : DEFAULT_PORT;
  loadPlaywright(); // báo thiếu Playwright trước khi tốn thời gian xuất

  const repoDir = path.join(work, 'repo');
  const sessions = [...new Set(entries.map((e) => e.session))];
  if (workState === 'new') {
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(
      path.join(work, WORK_MARKER),
      'Thư mục làm việc của scripts/screens/capture.cjs\n',
    );
  }
  if (!opts.skipExport) {
    emptyDirExcept(repoDir, 'node_modules');
    if (source === 'worktree') copyWorktree(repoDir);
    else copyGitRef(source, repoDir);
    ensureNodeModules(repoDir);
  }

  const total = { shots: [], pageErrors: [], consoleErrors: [], failures: [] };
  for (const session of sessions) {
    const distDir = path.join(work, `dist-${session}`);
    if (opts.skipExport) {
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        throw new Error(`--skip-export nhưng chưa có bản xuất cho phiên ${session}: ${distDir}`);
      }
    } else {
      log(`\nXuất web, phiên giả ${session}...`);
      exportWeb(repoDir, distDir, session, extraEnv);
    }
    const server = await startStaticServer(distDir, port);
    log(`\nChụp (phiên ${session}) tại ${server.url} -> ${out}`);
    try {
      const result = await shoot({
        baseUrl: server.url,
        entries: entries.filter((e) => e.session === session),
        sizes: parseSizes(opts.sizes),
        scale: opts.scale ? Number(opts.scale) : DEFAULT_SCALE,
        outDir: out,
        log,
      });
      for (const key of Object.keys(total)) total[key].push(...result[key]);
    } finally {
      await server.close();
    }
  }
  const reportFile = path.join(work, 'report.json');
  fs.writeFileSync(reportFile, `${JSON.stringify(total, null, 2)}\n`);
  log(`\nBáo cáo: ${reportFile}`);
  process.exitCode = reportResult(total, Boolean(opts.allowPageErrors));
}

main().catch((err) => {
  process.stderr.write(`${err.message ?? err}\n`);
  process.exitCode = 1;
});
