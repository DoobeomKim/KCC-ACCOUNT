# 출장경비 관리 시스템 개발 기록

## 2024-03-24 개발 내용

### 1. 경비 조회 화면 구현
- 테이블 형식의 리스트 뷰 구현
- 각 항목에 Delete 버튼 추가
- 이름 클릭 시 세부 정보 페이지로 이동하도록 구현

### 2. 출장경비 입력 화면 구현
- 기본 정보 섹션 (제목, 부서, 카테고리, 설명)
- 날짜 및 금액 섹션
- 첨부 파일 업로드 섹션
- 폼 데이터 자동 저장 기능 구현 (localStorage 활용)

### 주요 컴포넌트
- ShadCN 컴포넌트 사용
  - Table, Select, Calendar, Input, Button 등
- 반응형 레이아웃 구현
- 다국어 지원 (한국어/독일어)

### 다음 작업 예정
- 실제 데이터 저장 기능 구현
- 파일 업로드 기능 구현
- 세부 정보 페이지 구현

## 참고사항
- 프로젝트 경로: `/Volumes/EULS SSD/BRIDGEMAKERS/account`
- 기술 스택: Next.js 14, TypeScript, Tailwind CSS, ShadCN
- 데이터베이스: Supabase 