# ST — 게임 허브 (백룸 & HERO FACTORY)

두 개의 독립 게임을 허브 화면에서 선택해 플레이하는 웹 앱입니다.

- **BACKROOMS** — 3D 공포 탈출 게임 (FPS · 호러 · 탐험)
- **HERO FACTORY** — 2D 만화풍 슈퍼히어로 게임. 히어로/빌런 역할 선택 → 이름 입력 →
  외형 제작(헤어스타일 · 얼굴 · 의상 · 망토 · 색상)까지 구현되어 있습니다.
  전투 · 퀘스트는 추후 업데이트 예정입니다.

두 게임은 `src/backrooms/`와 `src/herofactory/`에 각각 자립완결 구조로 들어 있고,
`src/hub/GameHub.tsx`가 어느 게임을 띄울지 라우팅합니다. 서로 import하지 않습니다.

## 로컬 실행

1. 의존성 설치: `npm install`
2. 개발 서버 실행: `npm run dev` → http://localhost:3000
3. 프로덕션 빌드: `npm run build` (`npm run lint`로 타입 검사)

## 참고: SMB/UNC 공유 폴더에서의 vite 패치

이 저장소를 네트워크 공유(UNC 경로, 예: `\\서버\공유\...`)에서 사용할 때 vite 6의
UNC 경로 처리 버그 때문에 빌드가 실패합니다. 그래서 `npm install` 시 postinstall이
`scripts/patch-vite-unc.cjs`를 실행해 vite 청크를 직접 패치합니다.

- 패치 배경과 내용은 스크립트 상단 주석에 정리되어 있습니다.
- vite 버전을 올리면 패턴이 달라져 스크립트가 실패할 수 있습니다. 이때는 스크립트를
  새 청크 코드에 맞게 갱신하거나, 업스트림에서 버그가 고쳐졌다면 스크립트와
  package.json의 postinstall 항목을 함께 제거하세요.
