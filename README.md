# Tachyon Website

충북대학교 자작자동차 동아리 **Tachyon** 공식 홈페이지입니다.

사이트는 Astro로 정적 페이지를 빌드하고, Node.js 서버가 빌드 결과물과 관리자 API를 함께 제공합니다. 별도 데이터베이스 없이 `data/*.json`과 `uploads/` 폴더를 운영 데이터로 사용합니다.

## 주요 기능

- 국문/영문 Home, About US 페이지
- Our Cars, Members, Gallery, Sponsors, Contact US 페이지
- `/admin` 관리자 페이지에서 텍스트, 링크, 이미지, 목록 데이터 수정
- 멤버 연도별 페이지, OB, Archive 페이지 자동 구성
- 갤러리 블록 크기 관리
- 스폰서 로고 및 카드 관리
- 방문 통계 저장 및 관리자 페이지 표시
- 업로드 이미지 WebP 최적화
- 관리자 API Origin 검사, 로그인 시도 제한, 기본 보안 헤더 적용

## 기술 스택

- Astro
- Node.js
- Sharp
- HTML/CSS/JavaScript
- JSON file storage

## 폴더 구조

```text
astro-site/
├─ data/                  # 사이트 운영 JSON 데이터
├─ public/images/         # Git에 포함되는 기본 이미지
├─ server/server.mjs      # 정적 파일 서버 + 관리자 API
├─ src/
│  ├─ layouts/            # 공통 레이아웃
│  ├─ pages/              # Astro 페이지
│  ├─ styles/global.css   # 전체 스타일
│  └─ utils/              # 공개 페이지 렌더링 유틸
├─ uploads/               # 관리자 업로드 이미지, Git 제외
├─ dist/                  # 빌드 결과, Git 제외
├─ docs/HANDOVER.md       # 운영 인수인계 문서
├─ package.json
└─ README.md
```

## 실행 방법

의존성 설치:

```bash
npm install
```

개발 서버:

```bash
npm run dev
```

빌드:

```bash
npm run build
```

운영 서버:

```bash
TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve
```

Windows PowerShell:

```powershell
$env:TACHYON_ADMIN_PASSWORD="change-this-password"
npm run serve
```

기본 주소:

```text
http://localhost:4321
http://localhost:4321/admin
```

주의: `npm run dev`는 Astro 개발 서버입니다. 관리자 저장 API까지 실제처럼 확인하려면 `npm run build` 후 `npm run serve`로 실행하세요.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `PORT` | 서버 포트, 기본값 `4321` |
| `TACHYON_ADMIN_PASSWORD` | `data/auth.json`이 없을 때 사용할 초기 관리자 비밀번호 |
| `TACHYON_SESSION_SECRET` | 관리자 세션 서명 키. 운영 서버에서는 고정값 권장 |
| `TACHYON_SITE_ORIGIN` | 관리자 API Origin 검사에 사용할 공개 사이트 주소 |
| `TACHYON_DATA_DIR` | `data/` 대신 사용할 데이터 폴더 |
| `TACHYON_UPLOAD_DIR` | `uploads/` 대신 사용할 업로드 폴더 |

`.env.example`은 예시 파일입니다. 서버가 `.env`를 자동으로 읽지는 않으므로 shell, systemd, 호스팅 환경 변수에 직접 설정해야 합니다.

## 관리자 페이지

관리자 페이지 주소:

```text
/admin
```

수정 가능한 항목:

- Home, Home EN
- About US, About US EN
- Our Cars
- Members, OB, Archive
- Gallery
- Sponsors
- Contact US
- 관리자 비밀번호

초기 실행 시 `data/auth.json`이 없으면 `TACHYON_ADMIN_PASSWORD` 값으로 로그인합니다. 관리자 페이지에서 비밀번호를 변경하면 해시가 `data/auth.json`에 저장됩니다.

`data/auth.json`은 Git에 올리면 안 됩니다.

## 이미지 관리

기본 이미지는 `public/images/`에 둡니다.

관리자 페이지에서 업로드한 이미지는 `uploads/`에 저장되며 Git에 포함하지 않습니다. 운영 서버 이전이나 백업 시 반드시 `uploads/`를 함께 백업해야 합니다.

업로드 최적화 정책:

- 일반 업로드 이미지는 WebP로 변환하고 큰 이미지는 최대 폭 기준으로 줄입니다.
- 갤러리, 멤버 프로필, 스폰서 이미지는 일반 최적화 대상입니다.
- 멤버 큰 대표 이미지와 Archive 큰 이미지는 손실을 줄이기 위해 lossless WebP로 저장합니다.

## 스타일 기준

- 모바일에서도 스폰서와 갤러리 배치는 유지합니다.
- 스폰서 로고는 카드 안에서 가능한 크게 보이도록 조정되어 있습니다.
- 이미지 hover 효과는 이동이나 확대 없이 빨간 테두리만 표시합니다.
- 과한 애니메이션은 사용하지 않습니다.

## 보안과 운영 주의사항

- 운영 서버에서는 반드시 강한 `TACHYON_ADMIN_PASSWORD`를 설정하세요.
- 운영 서버에서는 `TACHYON_SESSION_SECRET`을 고정값으로 설정하는 것을 권장합니다.
- `data/auth.json`, `uploads/`, `.env`, `dist/`, `node_modules/`는 Git에 올리지 않습니다.
- 관리자 API는 Origin 검사를 수행합니다. 배포 도메인이 바뀌면 `TACHYON_SITE_ORIGIN`을 맞춰 주세요.
- 로그인 실패는 일정 횟수 이상 반복되면 잠시 제한됩니다.
- 보안 헤더는 서버 응답에 기본 적용됩니다.

## 배포 예시

```bash
npm install
npm run build
PORT=4321 TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve
```

Nginx 뒤에서 실행할 경우 `X-Forwarded-Proto`와 `Host` 헤더가 유지되어야 합니다.

```nginx
location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 백업

운영 중 계속 바뀌는 데이터:

```text
data/*.json
uploads/
```

특히 아래 항목은 Git으로 복구되지 않습니다.

```text
data/auth.json
data/visits.json
uploads/
```

백업 예시:

```bash
tar -czf tachyon-backup-$(date +%Y%m%d).tar.gz data uploads
```

## GitHub 업로드 전 체크

```bash
npm run build
git status
```

확인할 것:

- `npm run build` 통과
- `data/auth.json` 제외
- `uploads/` 제외
- `.env` 제외
- 실제 운영 비밀번호가 코드나 README에 없음
- 필요한 기본 이미지는 `public/images/`에 있음

## 자주 쓰는 명령

```bash
npm run dev
npm run build
npm run serve
node --check server/server.mjs
```

Windows에서 Vite 캐시 문제로 빌드가 막히면:

```powershell
Remove-Item .\node_modules\.vite -Recurse -Force
npm run build
```

---

Made for **Tachyon**.
