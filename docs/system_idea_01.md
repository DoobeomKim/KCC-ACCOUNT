출장 경비 관리 시스템 구조 아이디어
출장 경비 입력부터 저장, 조회까지의 전체 흐름을 구현하기 위한 구조를 제안해드리겠습니다.
1. 데이터 흐름 구조
출장 경비 입력 → 요약 화면 → 최종 저장 → 경비 조회 페이지

2. 페이지 구조
A. 출장 경비 입력 페이지 (/business-expense)
-현재 구현된 페이지
-필수 항목 검증 로직 추가
-저장하기 버튼 클릭 시 요약 페이지로 이동

B. 요약 페이지 (/business-expense/summary)
-입력된 데이터 요약 표시
-PDF 저장 기능
-뒤로 돌아가기 버튼
-최종 저장하기 버튼

C. 경비 조회 페이지 (/expense-list)
-저장된 모든 출장 경비 목록 표시
-각 항목 상세 보기, 수정, 삭제 기능
-필터링 및 정렬 기능

3. 상태 관리 전략
A. 임시 상태 관리
    1. 세션 스토리지 활용
        - 출장 경비 입력 → 요약 페이지 이동 시 세션 스토리지에 데이터 저장
        - 뒤로 돌아가기 시 세션 스토리지에서 데이터 복원
    2. Context API 활용
        - ExpenseContext 생성
        - 입력 데이터를 Context에 저장하여 페이지 간 공유
B. 영구 저장 전략
    1. 데이터베이스 구조

   expenses 테이블:
   - id (PK)
   - user_id (FK)
   - name
   - start_date
   - end_date
   - purpose
   - project_name
   - project_number
   - created_at
   - updated_at
   - status (draft, submitted, approved, rejected)
   
   expense_items 테이블:
   - id (PK)
   - expense_id (FK)
   - type (transportation, accommodation, meal, entertainment)
   - details (JSON)
   - amount
   - paid_by
   - created_at
   - updated_at


    2. API 엔드포인트
- POST /api/expenses - 새 경비 생성
- GET /api/expenses - 경비 목록 조회
- GET /api/expenses/:id - 특정 경비 상세 조회
- PUT /api/expenses/:id - 경비 수정
- DELETE /api/expenses/:id - 경비 삭제
- GET /api/expenses/:id/pdf - PDF 생성

4. PDF 생성 전략
    1. 클라이언트 측 생성
        - react-pdf 또는 jspdf 라이브러리 활용
        - 브라우저에서 직접 PDF 생성 및 다운로드
    2. 서버 측 생성
        - puppeteer 또는 PDFKit 활용
        - 서버에서 PDF 생성 후 클라이언트에 전송
        - API 엔드포인트: GET /api/expenses/:id/pdf

5. 구현 단계

1단계: 출장 경비 입력 페이지 완성
- 필수 항목 검증 로직 추가
- 저장 시 세션 스토리지에 데이터 저장

2단계: 요약 페이지 구현
- 레이아웃 및 디자인
- PDF 생성 기능
- 뒤로 가기 및 최종 저장 기능

3단계: 경비 조회 페이지 구현
- 목록 표시 및 페이지네이션
- 필터링 및 정렬 기능
- 상세 보기, 수정, 삭제 기능

4단계: API 및 데이터베이스 연동
- API 엔드포인트 구현
- 데이터베이스 스키마 설계 및 마이그레이션
- 프론트엔드와 백엔드 연동

6. 기술 스택 제안

프론트엔드
- Next.js (현재 사용 중)
- ShadCN UI (현재 사용 중)
- React Context API (상태 관리)
- react-pdf 또는 jspdf (PDF 생성)
- react-query (API 통신)

백엔드
- Next.js API Routes 또는 별도 백엔드 서버
- Prisma 또는 TypeORM (ORM)
- PostgreSQL 또는 MySQL (데이터베이스)
- JWT (인증)
- Puppeteer 또는 PDFKit (서버 측 PDF 생성)

7. 추가 고려사항
사용자 경험 개선
- 자동 저장 기능 (5분마다 임시 저장)
- 입력 중 이탈 시 경고 메시지
- 입력 진행 상태 표시 (프로그레스 바)

보안
- 인증 및 권한 관리
- 데이터 암호화
- CSRF 보호

확장성
- 다국어 지원 (이미 구현 중)
- 테마 지원
- 모바일 반응형 디자인
- 경비 승인 워크플로우 (관리자 승인 기능)
