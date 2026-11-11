// scripts/patch-vite-unc.cjs — vite 6의 UNC(네트워크 공유) 경로 버그 패치
//
// 이 저장소는 SMB 공유(\\192.168.0.225\학원공유\...) 위에 있고, vite 6은 UNC 경로를
// 두 곳에서 깨뜨려 `vite build`가 실패한다:
//
//  1) normalizePath$N()이 path.posix.normalize를 사용하는데 posix.normalize는
//     '//서버/공유/...'를 '/서버/공유/...'로 붕괴시킨다. 이후 path.win32.join이
//     '\서버\공유\...'(존재할 수 없는 경로)를 만들어 모든 패키지 해석이
//     packageEntryFailure로 실패한다. → UNC 이중 슬래시를 복원해 보정한다.
//  2) safeRealpathSync가 최종적으로 fs.realpathSync.native로 교체되는데, native는
//     매핑된 드라이브 문자(Z:\...)를 UNC로 되돌려 버린다. 그러면 vite 루트(Z:)와
//     모듈 id(UNC)가 어긋나 rollup emit fileName이 절대경로가 되어 빌드가 실패한다.
//     → 초기값을 드라이브 문자를 유지하는 JS 구현(fs.realpathSync)으로 고정한다.
//
// node_modules는 git에 없으므로 npm install 때마다 패치가 지워진다.
// package.json의 postinstall이 이 스크립트를 자동으로 다시 적용한다.
//
// vite를 업그레이드해서 이 스크립트가 실패하면(패턴 불일치) 새 청크 코드에 맞게
// 스크립트를 갱신하거나, 업스트림에서 버그가 고쳐졌다면 이 스크립트와
// package.json의 postinstall 항목을 함께 제거한다.

const fs = require('fs');
const path = require('path');

// 테스트용 인자로 청크 디렉터리를 직접 지정할 수 있다.
const chunksDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'node_modules', 'vite', 'dist', 'node', 'chunks');

if (!fs.existsSync(chunksDir)) {
  console.log('[patch-vite-unc] vite 청크 디렉터리가 없어 건너뜁니다:', chunksDir);
  process.exit(0);
}

// 패치 1 대상 원본:
//   function normalizePath$3(id) {
//     return path$b.posix.normalize(isWindows$3 ? slash$1(id) : id);
//   }
// 변수 접미사($3, $b 등)는 vite 버전에 따라 달라질 수 있으므로 캡처해서 재사용한다.
const normalizeRe = /function (normalizePath\$\w+)\((\w+)\)\s*\{\s*return (path\$\w+)\.posix\.normalize\((isWindows\$\w+)\s*\?\s*(slash\$\w+)\(\2\)\s*:\s*\2\);\s*\}/g;

// 패치 2 대상 원본:
//   let safeRealpathSync = isWindows$3 ? windowsSafeRealPathSync : fs__default.realpathSync.native;
const safeRe = /let safeRealpathSync = isWindows\$\w+ \? windowsSafeRealPathSync : (\w+)\.realpathSync\.native;/;

// 생성된 소스에 기록할 이중백슬래시 리터럴("\\" 4문자 = 런타임 값 2백슬래시).
const UNC_LITERAL = String.fromCharCode(92).repeat(4);

let normalizeOk = false; // 이번 실행에서 적용했거나 이미 적용되어 있음
let normalizeSeen = false; // normalizePath 함수가 청크에 존재함
let safeOk = false;
let safeSeen = false;
let changedFiles = 0;

for (const name of fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js'))) {
  const full = path.join(chunksDir, name);
  let content = fs.readFileSync(full, 'utf8');
  const before = content;

  if (content.includes('function normalizePath$')) normalizeSeen = true;
  if (content.includes('windowsSafeRealPathSync')) safeSeen = true;

  let normalizeApplied = false;
  content = content.replace(normalizeRe, (m, fn, param, pathVar, winVar, slashVar) => {
    normalizeApplied = true;
    return [
      `function ${fn}(${param}) {`,
      `  const normalized = ${pathVar}.posix.normalize(${winVar} ? ${slashVar}(${param}) : ${param});`,
      `  if (${winVar} && typeof ${param} === "string" && (${param}.startsWith("${UNC_LITERAL}") || ${param}.startsWith("//")) && normalized.startsWith("/") && !normalized.startsWith("//")) {`,
      `    return "/" + normalized;`,
      `  }`,
      `  return normalized;`,
      `}`
    ].join('\n');
  });
  if (normalizeApplied) {
    normalizeOk = true;
    console.log(`[patch-vite-unc] ${name}: normalizePath UNC 보존 패치 적용`);
  } else if (content.includes('!normalized.startsWith("//")')) {
    normalizeOk = true;
    console.log(`[patch-vite-unc] ${name}: normalizePath 패치 이미 적용됨`);
  }

  let safeApplied = false;
  content = content.replace(safeRe, (m, fsVar) => {
    safeApplied = true;
    return `let safeRealpathSync = ${fsVar}.realpathSync;`;
  });
  if (safeApplied) {
    safeOk = true;
    console.log(`[patch-vite-unc] ${name}: safeRealpathSync JS realpath 고정 패치 적용`);
  } else if (/let safeRealpathSync = \w+\.realpathSync;/.test(content)) {
    safeOk = true;
    console.log(`[patch-vite-unc] ${name}: safeRealpathSync 패치 이미 적용됨`);
  }

  if (content !== before) {
    fs.writeFileSync(full, content);
    changedFiles++;
  }
}

const failures = [];
if (normalizeSeen && !normalizeOk) {
  failures.push('normalizePath 함수가 청크에 있지만 패치를 적용하지 못했습니다 (패턴 불일치).');
}
if (safeSeen && !safeOk) {
  failures.push('safeRealpathSync 초기값이 청크에 있지만 패치를 적용하지 못했습니다 (패턴 불일치).');
}
if (failures.length > 0) {
  for (const msg of failures) console.error('[patch-vite-unc] 실패:', msg);
  console.error('[patch-vite-unc] vite 버전이 바뀐 것 같습니다. scripts/patch-vite-unc.cjs를 새 청크');
  console.error('[patch-vite-unc] 코드에 맞게 갱신하거나, 업스트림에서 버그가 고쳐졌다면 이 스크립트와');
  console.error('[patch-vite-unc] package.json의 postinstall 항목을 함께 제거하세요.');
  process.exit(1);
}

console.log(`[patch-vite-unc] 완료 (수정된 청크 파일: ${changedFiles}개)`);
