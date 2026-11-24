# 제작 작업실 (studio)

영상 제작 워크플로를 칸반으로 관리하는 개인용 웹앱입니다.

- `studio/` — Vite + React 앱. 에피소드 단계를 작업 주체(AI/사람)별로 보여 줍니다.
- `remotion/`, `hyperframes/` — 렌더 템플릿.

채널 기획 문서와 에피소드 데이터는 이 저장소에 없습니다. 앱의 **연결** 화면에서
비공개 데이터 저장소와 Fine-grained 토큰(Contents 읽기/쓰기)을 입력해 사용합니다.

```
cd studio
npm install
npm run dev   # 로컬 폴더(../episodes)를 직접 읽음
```
