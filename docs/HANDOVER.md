# Tachyon Website Handover Guide

이 문서는 Tachyon 홈페이지를 다음 운영자에게 넘길 때 확인해야 할 항목을 정리한 인수인계 문서입니다.

자세한 개발/배포 설명은 [README.md](../README.md)를 기준으로 보고, 실제 운영 중 반복하는 일은 이 문서를 먼저 보면 됩니다.

## 1. 꼭 넘겨야 하는 정보

새 운영자에게 아래 정보를 전달합니다.

- 홈페이지 주소
- 관리자 페이지 주소: `/admin`
- 현재 관리자 비밀번호
- 학교 서버 접속 방법
- 서버 안에서 프로젝트가 있는 경로
- systemd 서비스 이름: 예시 `tachyon-site`
- 백업 파일 위치
- 도메인/Nginx 설정 담당자 또는 위치

관리자 비밀번호는 GitHub, README, 단체 채팅방처럼 오래 남는 곳에 적지 않습니다.

## 2. 평소 수정 방법

일반 콘텐츠 수정은 GitHub나 코드 수정이 아니라 관리자 페이지에서 처리합니다.

관리자 페이지에서 수정할 수 있는 항목:

- Home
- Home EN
- About US
- About US EN
- Our Cars
- Members
- Gallery
- Sponsors
- Contact US
- 방문 조회수 확인
- 관리자 비밀번호 변경

수정 후에는 바로 실제 페이지에 접속해서 이미지, 줄바꿈, 링크가 정상인지 확인합니다.

## 3. 멤버 추가 방법

새 학년도 멤버를 추가할 때는 `/admin`의 `Members` 항목에서 처리합니다.

확인할 것:

- 연도 이름이 정확한지
- 대표 이미지가 있는지
- 각 멤버 이름, 역할, 사진이 맞는지
- OB와 Archive는 연도별 멤버와 별개로 관리되는지
- `/members` 페이지에서 새 항목이 선택창에 나오는지

과거 주소는 서버에서 새 주소로 redirect됩니다.

- `/members2026` -> `/members/2026`
- `/membersArchive` -> `/members/archive`
- `/membersOB` -> `/members/ob`

## 4. 이미지 관리

갤러리 사진은 `/admin`의 `Gallery` 항목에서 관리합니다.

갤러리 관리 방식:

- `줄 추가`로 화면에 보일 갤러리 줄을 만듭니다.
- 각 줄 안에서 `사진 추가`를 누릅니다.
- 사진을 올리기 전에 블록 수를 선택합니다.
- `1 block`은 작은 사진, `2 block`은 가로형 사진, `4 block`은 큰 정사각형 사진, `6 block`은 한 줄 전체 사진입니다.
- 업로드 후 반드시 `저장`을 눌러야 실제 페이지에 반영됩니다.

기본 이미지와 운영 중 업로드 이미지는 위치가 다릅니다.

- 기본 이미지: `public/images/`
- 관리자 페이지에서 업로드한 이미지: `uploads/`

`uploads/`는 GitHub에 올라가지 않습니다. 서버 이전이나 백업 때 반드시 같이 옮겨야 합니다.

권장 방식:

- 새 운영 사진은 관리자 페이지에서 업로드
- 사이트 기본 로고나 고정 자산은 `public/images/`에 저장
- 이미지 파일명은 가능하면 영문, 숫자, 하이픈을 사용
- 너무 큰 원본 사진은 용량을 줄인 뒤 업로드

## 5. 백업해야 하는 것

운영 중 가장 중요한 데이터는 아래 두 가지입니다.

```text
data/
uploads/
```

특히 아래 파일과 폴더는 서버에서만 계속 바뀔 수 있습니다.

```text
data/auth.json
data/visits.json
uploads/
```

권장 백업 주기:

- 큰 행사 사진을 올린 직후
- 멤버 정보를 많이 수정한 직후
- 최소 월 1회
- 서버 이전 전

백업 명령 예시:

```bash
tar -czf tachyon-backup-$(date +%Y%m%d).tar.gz data uploads
```

## 6. 서버 재시작

systemd로 운영 중이면 아래 명령을 사용합니다.

```bash
sudo systemctl restart tachyon-site
sudo systemctl status tachyon-site
```

로그 확인:

```bash
journalctl -u tachyon-site -f
```

서비스 이름이 다르면 `tachyon-site` 대신 실제 서비스 이름을 사용합니다.

## 7. 관리자 비밀번호를 잊어버렸을 때

서버에서 `data/auth.json`을 삭제하고 서버를 재시작합니다.

```bash
rm data/auth.json
sudo systemctl restart tachyon-site
```

이후 systemd 또는 실행 환경에 설정된 `TACHYON_ADMIN_PASSWORD`가 초기 비밀번호가 됩니다.

직접 실행하는 경우:

```bash
rm data/auth.json
TACHYON_ADMIN_PASSWORD='새초기비밀번호' npm run serve
```

로그인 후에는 `/admin`에서 새 비밀번호로 다시 변경합니다.

## 8. GitHub에 올릴 때 주의할 것

GitHub에 올리면 안 되는 것:

- `data/auth.json`
- `uploads/`
- `.env`
- `.env.production`
- `dist/`
- `node_modules/`

GitHub에 올려도 되는 것:

- `src/`
- `server/`
- `public/`
- `data/auth.json`을 제외한 기본 `data/*.json`
- `README.md`
- `docs/`
- `.env.example`

업로드 전 확인:

```bash
npm run build
git status
```

## 9. 자주 생기는 문제

### 관리자 로그인이 404로 실패함

`npm run dev`로 접속했을 가능성이 큽니다. 관리자 저장 API는 운영 서버에서 확인합니다.

```bash
npm run build
TACHYON_ADMIN_PASSWORD='초기비밀번호' npm run serve
```

### 이미지를 올렸는데 GitHub에서 안 보임

정상입니다. 관리자 업로드 이미지는 `uploads/`에 저장되고 GitHub에서 제외됩니다.

### 비밀번호 환경변수를 바꿨는데 적용되지 않음

`data/auth.json`이 이미 있으면 그 파일이 우선입니다. 초기화하려면 `data/auth.json`을 삭제해야 합니다.

### 서버에서 저장이 안 됨

`data/`와 `uploads/`에 쓰기 권한이 있는지 확인합니다.

```bash
ls -ld data uploads
```

필요하면 서버 운영 사용자에게 권한을 줍니다.

```bash
sudo chown -R $USER:$USER data uploads
```
