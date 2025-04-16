1. 루트 레이아웃 (src/app/[locale]/layout.tsx)
국제화, 메타데이터, 기본 HTML 구조 담당
모든 페이지에 공통으로 적용되는 최소한의 구조만 포함

2. 인증 레이아웃 (src/app/[locale]/auth/layout.tsx)
인증 페이지만을 위한 간단한 레이아웃
모바일 헤더나 사이드바 없이 깔끔한 페이지 구성

3. 앱 공통 레이아웃 컴포넌트 (src/components/layout/AppLayout.tsx)
모바일 헤더와 사이드바 포함
푸터 등 공통 UI 요소 포함
재사용 가능한 컴포넌트로 구현

4. 각 섹션별 레이아웃
대시보드 (src/app/[locale]/dashboard/layout.tsx)
경비 관리 (src/app/[locale]/business-expense/layout.tsx)
경비 목록 (src/app/[locale]/expense-list/layout.tsx)
설정 (src/app/[locale]/settings/layout.tsx)
관리자 페이지 (src/app/[locale]/admin/layout.tsx)
각각 AppLayout을 재사용