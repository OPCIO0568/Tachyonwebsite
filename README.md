# Tachyon Website

<p align="center">
  <img src="public/images/tachyon-logo-link.png" alt="Tachyon logo" width="120" />
  <img src="public/images/cbnu.png" alt="CBNU logo" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Astro-FF5D01?style=for-the-badge&logo=astro&logoColor=white" alt="Astro" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
</p>

<p align="center">
  충북대학교 자작 포뮬러 동아리 <strong>Tachyon</strong> 공식 홍보 홈페이지
  <br />
  <strong>Domain</strong>: <code>https://tachyon.cbnu.ac.kr</code>
</p>

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [핵심 특징](#핵심-특징)
- [기술 스택](#기술-스택)
- [폴더 구조](#폴더-구조)
- [실행 방법](#실행-방법)
- [관리자 페이지](#관리자-페이지)
- [데이터 파일 설명](#데이터-파일-설명)
- [이미지 관리](#이미지-관리)
- [방문 조회수](#방문-조회수)
- [Ubuntu 서버 배포](#ubuntu-서버-배포)
- [백업과 복구](#백업과-복구)
- [비밀번호 초기화](#비밀번호-초기화)
- [추가 문서](#추가-문서)
- [GitHub 업로드 전 체크리스트](#github-업로드-전-체크리스트)
- [문제 해결](#문제-해결)

## 프로젝트 소개

이 저장소는 충북대학교 자작자동차 동아리 `Tachyon`의 공식 홍보 홈페이지입니다.

처음에는 Markdown 파일을 직접 수정하는 정적 사이트 구조였지만, 이후 비전공자도 운영할 수 있도록 `/admin` 관리자 페이지를 추가했습니다. 관리자는 브라우저에서 비밀번호로 로그인한 뒤 홈, 소개, 차량, 멤버, 스폰서, 연락처, 이미지, 방문 조회수를 관리할 수 있습니다.

운영 목표는 명확합니다.

- 후배가 코드를 몰라도 사이트 내용을 수정할 수 있어야 함
- 별도 데이터베이스 없이 학교 Ubuntu 서버에서 쉽게 운영할 수 있어야 함
- 운영 데이터는 서버의 JSON 파일과 업로드 폴더만 백업하면 되어야 함
- GitHub에는 소스 코드와 기본 데이터만 올리고, 실제 관리자 비밀번호와 업로드 파일은 올리지 않아야 함

## 핵심 특징

- Astro 기반 정적 페이지 빌드
- Node.js 커스텀 서버로 관리자 API 제공
- 별도 DB 없이 `data/*.json` 파일에 사이트 데이터 저장
- `/admin`에서 사이트 주요 콘텐츠 수정 가능
- 이미지 업로드 지원
- 멤버 시즌별 페이지 자동 구성
- `OB`, `Archive` 멤버 섹션 지원
- 국문/영문 Home, About US 관리 지원
- 페이지별 방문 조회수와 최근 7일 그래프 제공
- Ubuntu 서버에서 Node.js 프로세스 하나로 운영 가능

## 기술 스택

- [Astro](https://astro.build/)
- Node.js
- HTML/CSS/JavaScript
- JSON 파일 기반 데이터 저장

이 프로젝트는 Prisma, MySQL, PostgreSQL 같은 데이터베이스를 사용하지 않습니다. 동아리 홈페이지 규모에서는 JSON 파일 방식이 더 단순하고 백업도 쉽기 때문입니다.

## 폴더 구조

```text
astro-site/
├─ data/                    # 사이트 운영 데이터 JSON
│  ├─ home.json             # 국문 Home
│  ├─ home-en.json          # 영문 Home
│  ├─ intro.json            # 국문 About US
│  ├─ intro-en.json         # 영문 About US
│  ├─ history.json          # Our Cars, 수상 내역
│  ├─ members.json          # Members, OB, Archive
│  ├─ sponsors.json         # Sponsors
│  ├─ contact.json          # Contact US
│  ├─ visits.json           # 방문 조회수
│  └─ site-pages.json       # 관리자 페이지 목록
├─ public/
│  └─ images/               # 기본 이미지, 로고, 차량 사진
├─ server/
│  └─ server.mjs            # 운영 서버와 관리자 API
├─ src/
│  ├─ layouts/
│  │  └─ BaseLayout.astro   # 공통 레이아웃, 헤더, 푸터
│  ├─ pages/
│  │  ├─ admin.astro        # 관리자 페이지
│  │  ├─ index.astro        # 국문 Home
│  │  ├─ intro.astro        # 국문 About US
│  │  ├─ history.astro      # Our Cars
│  │  ├─ sponsors.astro     # Sponsors
│  │  ├─ contact.astro      # Contact US
│  │  ├─ members/
│  │  │  └─ index.astro     # Members
│  │  └─ en/
│  │     ├─ index.astro     # 영문 Home
│  │     └─ intro.astro     # 영문 About US
│  └─ styles/
│     └─ global.css         # 전역 스타일
├─ uploads/                 # 관리자 업로드 이미지, Git 제외
├─ dist/                    # 빌드 결과, Git 제외
├─ docs/
│  └─ HANDOVER.md            # 후배 인수인계용 운영 문서
├─ .env.example              # 서버 환경변수 예시
├─ package.json
└─ README.md
```

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

접속 주소:

```text
http://localhost:4321
```

주의: `npm run dev`는 Astro 개발 서버입니다. 화면 확인에는 좋지만 관리자 저장 API는 운영 서버인 `npm run serve`에서 확인하는 것이 정확합니다.

### 3. 빌드

```bash
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다.

`prebuild` 스크립트가 자동으로 Vite 캐시(`node_modules/.vite`)를 삭제합니다. Windows 환경에서 파일 변경 직후 첫 빌드가 Vite 캐시 문제로 실패하는 경우가 있어 안정성을 위해 넣었습니다.

### 4. 운영 서버 실행

```bash
TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve
```

접속 주소:

```text
http://localhost:4321
http://localhost:4321/admin
```

Windows PowerShell에서는 환경변수 문법이 다릅니다.

```powershell
$env:TACHYON_ADMIN_PASSWORD="change-this-password"
npm run serve
```

## 관리자 페이지

관리자 페이지 주소:

```text
/admin
```

관리자 페이지에서 수정할 수 있는 항목:

- `Home`: 국문 홈 페이지
- `Home EN`: 영문 홈 페이지
- `About US`: 국문 소개 페이지
- `About US EN`: 영문 소개 페이지
- `Our Cars`: 차량 시리즈, 차량 정보, 수상 내역
- `Members`: 시즌별 멤버, OB, Archive
- `Sponsors`: 스폰서 목록, 로고, 대표 이미지
- `Contact US`: 연락처, 소셜 링크, 대표 이미지

관리자 페이지에서 가능한 작업:

- 텍스트 수정
- 링크 수정
- 이미지 경로 직접 입력
- 이미지 업로드
- 목록 항목 추가/삭제
- 목록 순서 변경
- 관리자 비밀번호 변경
- 전체 조회수와 페이지별 최근 7일 그래프 확인

### 관리자 비밀번호 동작 방식

처음 서버를 실행할 때 `data/auth.json`이 없으면 `TACHYON_ADMIN_PASSWORD` 값이 초기 비밀번호로 사용됩니다.

`TACHYON_ADMIN_PASSWORD`도 설정하지 않으면 개발용 기본값인 `dev-password`가 사용됩니다. 운영 서버에서는 이 상태로 두면 안 되며, 서버를 켜자마자 `/admin`에서 비밀번호를 변경해야 합니다.

관리자 페이지에서 비밀번호를 변경하면 `data/auth.json`에 해시 값으로 저장됩니다. 이 파일이 생긴 뒤에는 `TACHYON_ADMIN_PASSWORD`를 바꿔도 기존 비밀번호가 유지됩니다.

`data/auth.json`은 Git에 올리면 안 됩니다. `.gitignore`에 이미 제외되어 있습니다.

## 데이터 파일 설명

모든 운영 데이터는 `data/` 폴더에 있습니다.

| 파일 | 설명 |
| --- | --- |
| `data/home.json` | 국문 Home 페이지 |
| `data/home-en.json` | 영문 Home 페이지 |
| `data/intro.json` | 국문 About US 페이지 |
| `data/intro-en.json` | 영문 About US 페이지 |
| `data/history.json` | Our Cars 차량 시리즈와 수상 내역 |
| `data/members.json` | 시즌별 멤버, OB, Archive |
| `data/sponsors.json` | 스폰서 정보 |
| `data/contact.json` | Contact US 연락처와 소셜 링크 |
| `data/visits.json` | 방문 조회수와 최근 7일 통계 |
| `data/site-pages.json` | 관리자 페이지 목록 |
| `data/auth.json` | 관리자 비밀번호 해시, Git 제외 |

`data/auth.json`을 제외한 JSON 파일은 기본 콘텐츠이므로 Git에 포함할 수 있습니다.

## 페이지 라우트

| 경로 | 설명 |
| --- | --- |
| `/` | 국문 Home |
| `/en` | 영문 Home |
| `/intro` | 국문 About US |
| `/en/intro` | 영문 About US |
| `/history` | Our Cars |
| `/members` | Members 기본 페이지 |
| `/members/2026` | 2026 시즌 Members |
| `/members/archive` | Members Archive |
| `/members/ob` | OB Members |
| `/sponsors` | Sponsors |
| `/contact` | Contact US |
| `/admin` | 관리자 페이지 |

기존 구형 멤버 URL도 서버에서 새 URL로 리다이렉트합니다.

| 기존 경로 | 새 경로 |
| --- | --- |
| `/members2026` | `/members/2026` |
| `/membersArchive` | `/members/archive` |
| `/membersOB` | `/members/ob` |

## 이미지 관리

이미지는 두 곳에서 관리됩니다.

### 기본 이미지

Git에 포함되는 기본 이미지는 `public/images/`에 있습니다.

예:

```text
public/images/banner.jpg
public/images/organization.png
public/images/vehicles/TF25.jpg
public/images/sponsors/keyang.png
```

페이지나 JSON에서 사용할 때는 `/images/...` 경로로 씁니다.

```json
{
  "image": "/images/vehicles/TF25.jpg"
}
```

### 관리자 업로드 이미지

관리자 페이지에서 업로드한 이미지는 `uploads/` 폴더에 저장됩니다.

예:

```text
uploads/home/hero/...
uploads/history/vehicles/...
uploads/members/2026/...
uploads/sponsors/logos/...
```

`uploads/`는 Git에 올리지 않습니다. 실제 운영 서버에서 계속 보관해야 하는 데이터이므로 반드시 백업해야 합니다.

## 방문 조회수

방문 조회수는 `data/visits.json`에 저장됩니다.

기록 방식:

- 공개 HTML 페이지 요청만 카운트
- `/admin`은 카운트하지 않음
- API 요청은 카운트하지 않음
- 이미지, CSS, JS 요청은 카운트하지 않음
- 전체 누적 조회수 유지
- 최근 7일 일별 데이터만 유지

관리자 페이지에서 확인 가능한 항목:

- 전체 조회수
- 최근 7일 조회수 그래프
- 페이지별 조회수 그래프

## Ubuntu 서버 배포

아래 예시는 Ubuntu 서버에서 직접 운영하는 방식입니다.

### 1. Node.js 설치

Node.js 20 이상을 권장합니다.

```bash
node -v
npm -v
```

설치되어 있지 않다면 NodeSource, nvm 등 학교 서버 정책에 맞는 방식으로 설치합니다.

### 2. 프로젝트 가져오기

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo/astro-site
```

저장소 루트가 `astro-site` 자체라면 `cd astro-site`는 생략합니다.

### 3. 의존성 설치와 빌드

```bash
npm install
npm run build
```

### 4. 운영 서버 실행

```bash
TACHYON_ADMIN_PASSWORD='반드시-바꿀-초기-비밀번호' npm run serve
```

기본 포트는 `4321`입니다.

다른 포트를 쓰려면:

```bash
PORT=3000 TACHYON_ADMIN_PASSWORD='반드시-바꿀-초기-비밀번호' npm run serve
```

### 5. systemd로 상시 실행

서버 재부팅 후에도 자동 실행되게 하려면 systemd 서비스를 만들 수 있습니다.

예시:

```ini
[Unit]
Description=Tachyon Website
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/tachyon/astro-site
Environment=NODE_ENV=production
Environment=PORT=4321
Environment=TACHYON_ADMIN_PASSWORD=반드시-바꿀-초기-비밀번호
ExecStart=/usr/bin/npm run serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

서비스 파일 위치 예:

```bash
sudo nano /etc/systemd/system/tachyon-site.service
```

등록:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tachyon-site
sudo systemctl start tachyon-site
sudo systemctl status tachyon-site
```

로그 확인:

```bash
journalctl -u tachyon-site -f
```

### 6. Nginx 리버스 프록시 예시

도메인에서 접속하려면 Nginx로 80/443 포트를 Node 서버로 연결합니다.

```nginx
server {
    server_name tachyon.cbnu.ac.kr;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 인증서는 학교 서버 정책 또는 `certbot` 등을 사용해 설정합니다.

## 백업과 복구

운영 중 반드시 백업해야 하는 항목:

```text
data/*.json
uploads/
```

특히 아래 파일은 운영 중 계속 바뀝니다.

```text
data/auth.json
data/visits.json
uploads/
```

권장 백업 명령:

```bash
tar -czf tachyon-backup-$(date +%Y%m%d).tar.gz data uploads
```

복구:

```bash
tar -xzf tachyon-backup-YYYYMMDD.tar.gz
npm run build
npm run serve
```

GitHub에는 `uploads/`와 `data/auth.json`이 올라가지 않으므로, 서버 이전 시 Git clone만으로는 운영 이미지와 관리자 비밀번호가 복구되지 않습니다. 백업 파일을 반드시 함께 옮겨야 합니다.

## 비밀번호 초기화

관리자 비밀번호를 잊어버렸다면 서버에서 `data/auth.json`을 삭제하고 서버를 재시작합니다.

```bash
rm data/auth.json
TACHYON_ADMIN_PASSWORD='새초기비밀번호' npm run serve
```

systemd를 쓰는 경우:

```bash
rm data/auth.json
sudo systemctl restart tachyon-site
```

systemd 환경변수에 들어 있는 `TACHYON_ADMIN_PASSWORD`가 새 초기 비밀번호가 됩니다.

Windows PowerShell에서는:

```powershell
Remove-Item .\data\auth.json
$env:TACHYON_ADMIN_PASSWORD="새초기비밀번호"
npm run serve
```

## 추가 문서

운영자를 넘길 때는 아래 문서를 함께 전달하면 됩니다.

- [docs/HANDOVER.md](docs/HANDOVER.md): 후배 인수인계용 운영 체크리스트
- [.env.example](.env.example): Ubuntu shell, systemd, 호스팅 환경에 넣을 환경변수 예시

`.env.example`은 예시 파일입니다. 현재 서버 코드는 `.env` 파일을 자동으로 읽지 않으므로, 실제 운영에서는 shell 환경변수나 systemd `Environment` 값으로 설정해야 합니다.

## GitHub 업로드 전 체크리스트

GitHub에 올리기 전 확인할 것:

- `npm install`이 완료되어 있는지
- `npm run build`가 통과하는지
- `data/auth.json`이 Git에 포함되지 않는지
- `uploads/`가 Git에 포함되지 않는지
- `.env` 파일이 Git에 포함되지 않는지
- 실제 운영 비밀번호가 README나 코드에 적혀 있지 않은지
- 기본 이미지가 `public/images/`에 존재하는지
- `data/*.json`이 정상 JSON인지

확인 명령:

```bash
npm run build
git status
```

Git에 올리면 안 되는 파일:

```text
data/auth.json
uploads/
.env
.env.production
dist/
node_modules/
```

## 자주 쓰는 명령

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 운영 서버
TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve

# 포트 지정 실행
PORT=3000 TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve

# 서버 문법 검사
node --check server/server.mjs
```

## 문제 해결

### `/admin`에서 로그인 API가 404가 나오는 경우

`npm run dev`로 실행한 Astro 개발 서버에 접속한 경우일 가능성이 큽니다.

관리자 저장 API는 커스텀 서버에서 동작합니다.

```bash
npm run build
TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve
```

그 다음 접속:

```text
http://127.0.0.1:4321/admin
```

Windows 환경에서는 `localhost`보다 `127.0.0.1`이 더 안정적일 수 있습니다.

### 비밀번호를 바꿨는데 `TACHYON_ADMIN_PASSWORD`가 적용되지 않는 경우

`data/auth.json`이 이미 있으면 해당 파일의 비밀번호 해시가 우선입니다.

초기화하려면:

```bash
rm data/auth.json
TACHYON_ADMIN_PASSWORD='새초기비밀번호' npm run serve
```

### 이미지를 업로드했는데 GitHub에 보이지 않는 경우

정상입니다. 관리자 업로드 이미지는 `uploads/`에 저장되고 Git에서 제외됩니다.

운영 서버의 업로드 이미지는 백업으로 관리해야 합니다.

### 빌드가 Vite 캐시 문제로 실패하는 경우

현재 `prebuild`에서 `node_modules/.vite`를 자동 삭제합니다.

수동으로 지우려면:

```bash
rm -rf node_modules/.vite
npm run build
```

Windows PowerShell:

```powershell
Remove-Item .\node_modules\.vite -Recurse -Force
npm run build
```

### 포트가 이미 사용 중인 경우

다른 포트로 실행합니다.

```bash
PORT=3000 TACHYON_ADMIN_PASSWORD='change-this-password' npm run serve
```

### 서버에서 파일 저장이 안 되는 경우

`data/`와 `uploads/` 폴더에 쓰기 권한이 있는지 확인합니다.

```bash
ls -ld data uploads
```

필요하면 서버 운영 사용자에게 권한을 줍니다.

```bash
sudo chown -R $USER:$USER data uploads
```

## 운영 원칙

- 일반 콘텐츠 수정은 `/admin`에서 처리합니다.
- 코드 수정이 필요한 경우에만 `src/`, `server/`, `public/`을 수정합니다.
- 운영 데이터 백업은 `data/`와 `uploads/`가 핵심입니다.
- 비밀번호와 업로드 이미지는 GitHub에 올리지 않습니다.
- 큰 변경 후에는 반드시 `npm run build`로 확인합니다.

---

Made for **Tachyon**.
