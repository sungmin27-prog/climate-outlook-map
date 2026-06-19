# 기후 전망 지도

지역을 지도에서 선택해 2021~2100년의 SSP 시나리오별 재난값 전망과 불확실성 범위를 보는 정적 웹 대시보드입니다.

## 데이터 보호 구조

- 원본 `전체시나리오_통합_전망데이터.csv`는 GitHub와 Netlify에 올리지 않습니다.
- `.gitignore`가 모든 CSV/TSV와 `private/` 폴더를 차단합니다.
- 브라우저에는 개별 Rank 50개를 제외한 `평균`, `P10`, `P90`만 전달됩니다.
- 공개 사이트의 `public/data/statistics.json`은 누구나 내려받을 수 있는 공개 집계 데이터입니다.

집계값까지 비공개여야 한다면 이 정적 배포 방식은 사용할 수 없습니다. 그 경우 원본을 비공개 DB/Object Storage에 두고 인증된 Netlify Function API만 집계 결과를 반환하도록 바꿔야 합니다.

## 데이터 다시 만들기

Node.js 20 이상에서 실행합니다. CSV 경로는 저장소 밖의 비공개 위치를 사용합니다.

```powershell
npm run analyze -- "C:\private\전체시나리오_통합_전망데이터.csv"
npm run build:data -- "C:\private\전체시나리오_통합_전망데이터.csv" "public\data\statistics.json"
npm run build:map
```

생성 결과는 228개 지역, 4개 시나리오, 80개 연도의 요약 통계입니다.

## 로컬 실행

파일을 직접 열면 브라우저의 `fetch` 제한 때문에 데이터가 로드되지 않습니다. 로컬 HTTP 서버로 확인합니다.

```powershell
python -m http.server 4173 --directory public
```

브라우저에서 `http://localhost:4173`을 엽니다.

## GitHub + Netlify 배포

1. 이 폴더를 새 GitHub 저장소에 Push합니다.
2. Netlify에서 **Add new site → Import an existing project → GitHub**를 선택합니다.
3. 저장소를 고르고 배포합니다. `netlify.toml`이 게시 폴더를 `public`으로 지정합니다.
4. 배포 로그와 공개 URL에서 CSV 파일이 없음을 다시 확인합니다.

빌드 명령은 필요하지 않습니다. 통계가 바뀔 때만 로컬에서 집계 JSON을 다시 생성해 커밋합니다.

## 지도 경계

행정경계는 [southkorea/southkorea-maps](https://github.com/southkorea/southkorea-maps)의 2013년 통계청 시군구 GeoJSON을 사용했습니다. 통합시 구 단위는 CSV의 시 단위로 묶고, 일부 변경 명칭을 현재 CSV 명칭에 연결했습니다.

