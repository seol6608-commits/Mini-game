# Mini Arcade

iPad에서 짧게 즐기기 위한 터치 중심 미니게임 모음입니다.

## 기기별 실행
- `index.html`: iPad 및 일반 화면 버전
- `s24.html`: Galaxy S24 Ultra 19.5:9 전용 버전
- 두 버전의 최고 기록과 플레이 횟수는 서로 분리되어 저장됩니다.

## 포함 게임
- 2048 Mini
- Snake
- Brick Breaker (60초 라운드)
- Stack Tower
- Minesweeper
- Dodge
- Memory

## 특징
- iPad Safari 터치 조작
- 쉬움·보통·어려움 공통 난이도 선택 및 난이도별 기록 저장
- 세로/가로 반응형
- 키보드 조작도 지원
- 게임별 최고 기록 localStorage 저장
- PWA 설치 가능
- GitHub Pages에서 그대로 배포 가능

## GitHub Pages 배포
1. 새 GitHub 저장소를 만듭니다.
2. 이 폴더의 파일들을 저장소 루트에 업로드합니다.
3. GitHub 저장소의 **Settings → Pages**로 이동합니다.
4. **Deploy from a branch**를 선택합니다.
5. `main` 브랜치와 `/ (root)`를 선택하고 저장합니다.
6. 생성된 Pages 주소를 iPad Safari에서 열고 **공유 → 홈 화면에 추가**를 누르면 앱처럼 사용할 수 있습니다.

Galaxy S24 Ultra에서는 Pages 주소 뒤에 `/s24.html`을 붙여 접속한 뒤 Chrome의 **홈 화면에 추가**를 사용하세요.

로컬에서는 정적 파일 서버로 실행하세요. 서비스 워커는 `file://` 환경에서는 동작하지 않습니다.
