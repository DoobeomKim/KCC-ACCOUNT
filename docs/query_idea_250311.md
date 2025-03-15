단계별 Supabase 스키마 구현 방법
Supabase에 직접 접근할 수는 없지만, 다음과 같은 단계로 스키마를 구현하실 수 있습니다:
1단계: 기본 테이블 생성
Supabase 대시보드의 SQL 에디터에서 다음 쿼리를 실행하여 기본 테이블을 생성합니다:

-- 1. business_expenses 테이블 생성
CREATE TABLE business_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_number TEXT UNIQUE,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE NOT NULL,
  end_time TIME,
  purpose TEXT,
  project_name TEXT,
  project_number TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. expense_visits 테이블 생성
CREATE TABLE expense_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES business_expenses(id) ON DELETE CASCADE,
  date DATE,
  company_name TEXT,
  city TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. expense_transportation 테이블 생성
CREATE TABLE expense_transportation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES business_expenses(id) ON DELETE CASCADE,
  date DATE,
  type TEXT CHECK (type IN ('flight', 'taxi', 'fuel', 'rental', 'km_pauschale')),
  country TEXT,
  company_name TEXT,
  paid_by TEXT CHECK (paid_by IN ('company', 'personal')),
  vat DECIMAL(10, 2),
  amount DECIMAL(10, 2),
  mileage DECIMAL(10, 2),
  license_plate TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. expense_accommodations 테이블 생성
CREATE TABLE expense_accommodations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES business_expenses(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  type TEXT CHECK (type IN ('hotel', 'private')),
  country TEXT,
  hotel_name TEXT,
  paid_by TEXT CHECK (paid_by IN ('company', 'personal')),
  city_tax DECIMAL(10, 2),
  vat DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. expense_accommodation_breakfasts 테이블 생성
CREATE TABLE expense_accommodation_breakfasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accommodation_id UUID REFERENCES expense_accommodations(id) ON DELETE CASCADE,
  breakfast_date DATE NOT NULL
);

-- 6. expense_entertainment 테이블 생성
CREATE TABLE expense_entertainment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES business_expenses(id) ON DELETE CASCADE,
  date DATE,
  type TEXT CHECK (type IN ('breakfast', 'lunch', 'dinner', 'coffee')),
  country TEXT,
  company_name TEXT,
  paid_by TEXT CHECK (paid_by IN ('company', 'personal')),
  vat DECIMAL(10, 2),
  amount DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

2단계: 인덱스 생성

-- 인덱스 생성
CREATE INDEX idx_business_expenses_user_email ON business_expenses(user_email);
CREATE INDEX idx_business_expenses_registration_number ON business_expenses(registration_number);
CREATE INDEX idx_expense_visits_expense_id ON expense_visits(expense_id);
CREATE INDEX idx_expense_transportation_expense_id ON expense_transportation(expense_id);
CREATE INDEX idx_expense_accommodations_expense_id ON expense_accommodations(expense_id);
CREATE INDEX idx_expense_accommodation_breakfasts_accommodation_id ON expense_accommodation_breakfasts(accommodation_id);
CREATE INDEX idx_expense_entertainment_expense_id ON expense_entertainment(expense_id);

3단계: 등록번호 자동 생성 함수 및 트리거 생성

-- 등록번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  next_number INT;
  reg_number TEXT;
BEGIN
  -- 현재 연도를 가져옴
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- 해당 연도의 마지막 번호를 가져옴
  SELECT COALESCE(MAX(CAST(SUBSTRING(registration_number FROM 6) AS INTEGER)), 0)
  INTO next_number
  FROM business_expenses
  WHERE registration_number LIKE year_prefix || '-%';
  
  -- 다음 번호 생성
  next_number := next_number + 1;
  
  -- 등록번호 형식: YYYY-00001
  reg_number := year_prefix || '-' || LPAD(next_number::TEXT, 5, '0');
  
  -- 새 등록번호 설정
  NEW.registration_number := reg_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER set_registration_number
BEFORE INSERT ON business_expenses
FOR EACH ROW
WHEN (NEW.registration_number IS NULL)
EXECUTE FUNCTION generate_registration_number();


4단계: 출장 경비 요약 뷰 생성 (수정된 버전)

-- 출장 경비 요약 뷰 (실시간 계산)
CREATE OR REPLACE VIEW expense_summary AS
SELECT 
  be.id,
  be.registration_number,
  be.user_email,
  be.name,
  be.start_date,
  be.end_date,
  be.purpose,
  be.project_name,
  be.status,
  -- 교통비 합계 (실시간 계산)
  COALESCE((SELECT SUM(amount) FROM expense_transportation WHERE expense_id = be.id), 0) AS transportation_total,
  -- 숙박비 합계 (실시간 계산)
  COALESCE((SELECT SUM(total_amount) FROM expense_accommodations WHERE expense_id = be.id), 0) AS accommodation_total,
  -- 접대비 합계 (실시간 계산)
  COALESCE((SELECT SUM(amount) FROM expense_entertainment WHERE expense_id = be.id), 0) AS entertainment_total,
  -- 식대 계산 (실시간 계산) - 수정된 부분
  ((be.end_date - be.start_date + 1) * 28) AS meal_allowance,
  -- 총 합계 (실시간 계산) - 수정된 부분
  COALESCE((SELECT SUM(amount) FROM expense_transportation WHERE expense_id = be.id), 0) +
  COALESCE((SELECT SUM(total_amount) FROM expense_accommodations WHERE expense_id = be.id), 0) +
  COALESCE((SELECT SUM(amount) FROM expense_entertainment WHERE expense_id = be.id), 0) +
  ((be.end_date - be.start_date + 1) * 28) AS grand_total,
  be.created_at,
  be.updated_at
FROM business_expenses be;

5단계: 사용자별 출장 경비 목록 함수 생성 (수정된 버전)

-- 사용자별 출장 경비 목록 함수 (실시간 계산)
CREATE OR REPLACE FUNCTION get_user_expenses(user_email TEXT)
RETURNS TABLE (
  id UUID,
  registration_number TEXT,
  name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT,
  transportation_total DECIMAL,
  accommodation_total DECIMAL,
  entertainment_total DECIMAL,
  meal_allowance DECIMAL,
  grand_total DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.id,
    be.registration_number,
    be.name,
    be.start_date,
    be.end_date,
    be.status,
    -- 교통비 합계 (실시간 계산)
    COALESCE((SELECT SUM(amount) FROM expense_transportation WHERE expense_id = be.id), 0) AS transportation_total,
    -- 숙박비 합계 (실시간 계산)
    COALESCE((SELECT SUM(total_amount) FROM expense_accommodations WHERE expense_id = be.id), 0) AS accommodation_total,
    -- 접대비 합계 (실시간 계산)
    COALESCE((SELECT SUM(amount) FROM expense_entertainment WHERE expense_id = be.id), 0) AS entertainment_total,
    -- 식대 계산 (실시간 계산) - 수정된 부분
    ((be.end_date - be.start_date + 1) * 28) AS meal_allowance,
    -- 총 합계 (실시간 계산) - 수정된 부분
    COALESCE((SELECT SUM(amount) FROM expense_transportation WHERE expense_id = be.id), 0) +
    COALESCE((SELECT SUM(total_amount) FROM expense_accommodations WHERE expense_id = be.id), 0) +
    COALESCE((SELECT SUM(amount) FROM expense_entertainment WHERE expense_id = be.id), 0) +
    ((be.end_date - be.start_date + 1) * 28) AS grand_total,
    be.created_at
  FROM business_expenses be
  WHERE be.user_email = user_email
  ORDER BY be.created_at DESC;
END;
$$ LANGUAGE plpgsql;


6단계: RLS(Row Level Security) 설정 (선택 사항)

-- RLS 활성화
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_transportation ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_accommodation_breakfasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_entertainment ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 데이터 접근 가능
CREATE POLICY admin_all_access ON business_expenses
  FOR ALL
  TO authenticated
  USING (
    auth.email() IN (SELECT email FROM users WHERE role = 'admin')
    OR auth.email() = user_email
  );

-- 다른 테이블에 대한 정책도 유사하게 설정


데이터베이스 업데이트 검증 방법
1. 스키마 검증
스키마 변경이 제대로 적용되었는지 확인하는 방법입니다:

-- 테이블 구조 확인
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_expenses'
ORDER BY ordinal_position;

-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'business_expenses';

-- 뷰 확인
SELECT viewname, definition
FROM pg_views
WHERE viewname = 'expense_summary';

-- 함수 확인
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_user_expenses';

-- 트리거 확인
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'business_expenses';

2. 테스트 데이터 삽입 및 조회
실제 데이터를 삽입하고 예상대로 동작하는지 확인합니다:

-- 테스트 데이터 삽입
INSERT INTO business_expenses (user_email, name, start_date, end_date, purpose)
VALUES ('test@example.com', '테스트 출장', '2023-11-01', '2023-11-03', '테스트 목적')
RETURNING id, registration_number;

-- 자동 생성된 등록번호 확인
SELECT registration_number FROM business_expenses WHERE user_email = 'test@example.com';

-- 교통비 추가
INSERT INTO expense_transportation (expense_id, date, type, country, company_name, amount)
VALUES 
  ((SELECT id FROM business_expenses WHERE user_email = 'test@example.com' ORDER BY created_at DESC LIMIT 1),
   '2023-11-01', 'taxi', '대한민국', '택시회사', 15000);

-- 숙박비 추가
INSERT INTO expense_accommodations (expense_id, start_date, end_date, type, country, hotel_name, total_amount)
VALUES 
  ((SELECT id FROM business_expenses WHERE user_email = 'test@example.com' ORDER BY created_at DESC LIMIT 1),
   '2023-11-01', '2023-11-02', 'hotel', '대한민국', '호텔명', 120000);

3. 계산 로직 검증
실시간 계산 로직이 제대로 작동하는지 확인합니다:

-- 요약 뷰에서 계산된 값 확인
SELECT 
  registration_number,
  transportation_total,
  accommodation_total,
  entertainment_total,
  meal_allowance,
  grand_total
FROM expense_summary
WHERE user_email = 'test@example.com';

-- 수동 계산과 비교
SELECT 
  be.registration_number,
  -- 교통비 합계
  (SELECT SUM(amount) FROM expense_transportation WHERE expense_id = be.id) AS manual_transportation_total,
  -- 숙박비 합계
  (SELECT SUM(total_amount) FROM expense_accommodations WHERE expense_id = be.id) AS manual_accommodation_total,
  -- 식대 계산
  ((be.end_date - be.start_date + 1) * 28) AS manual_meal_allowance
FROM business_expenses be
WHERE be.user_email = 'test@example.com';

-- 함수 호출 테스트
SELECT * FROM get_user_expenses('test@example.com');

4. 엣지 케이스 테스트
특수한 상황에서도 제대로 작동하는지 확인합니다:

-- 1. 날짜가 같은 경우 (당일 출장)
INSERT INTO business_expenses (user_email, name, start_date, end_date, purpose)
VALUES ('test@example.com', '당일 출장', '2023-11-10', '2023-11-10', '당일 미팅')
RETURNING id, registration_number;

-- 2. 데이터가 없는 경우
INSERT INTO business_expenses (user_email, name, start_date, end_date, purpose)
VALUES ('test@example.com', '데이터 없는 출장', '2023-11-15', '2023-11-17', '테스트')
RETURNING id, registration_number;

-- 결과 확인
SELECT 
  name,
  transportation_total,
  accommodation_total,
  entertainment_total,
  meal_allowance,
  grand_total
FROM expense_summary
WHERE user_email = 'test@example.com'
ORDER BY created_at DESC;

5. 트랜잭션 테스트
데이터 무결성이 유지되는지 확인합니다:

-- 트랜잭션 시작
BEGIN;

-- 출장 정보 추가
INSERT INTO business_expenses (user_email, name, start_date, end_date, purpose)
VALUES ('test@example.com', '트랜잭션 테스트', '2023-12-01', '2023-12-03', '테스트')
RETURNING id, registration_number;

-- 변수로 ID 저장 (실제로는 애플리케이션에서 처리)
DO $$
DECLARE
  expense_id UUID;
BEGIN
  SELECT id INTO expense_id FROM business_expenses 
  WHERE user_email = 'test@example.com' AND name = '트랜잭션 테스트';
  
  -- 교통비 추가
  INSERT INTO expense_transportation (expense_id, date, type, amount)
  VALUES (expense_id, '2023-12-01', 'taxi', 20000);
  
  -- 숙박비 추가
  INSERT INTO expense_accommodations (expense_id, start_date, end_date, type, hotel_name, total_amount)
  VALUES (expense_id, '2023-12-01', '2023-12-02', 'hotel', '호텔명', 150000);
END $$;

-- 결과 확인
SELECT * FROM expense_summary 
WHERE name = '트랜잭션 테스트';

-- 트랜잭션 커밋 또는 롤백
COMMIT; -- 또는 ROLLBACK;


6. 성능 테스트 (대량 데이터)
대량의 데이터에서도 성능이 유지되는지 확인합니다:

-- 대량 데이터 삽입 테스트 (예: 100개의 출장 데이터)
DO $$
DECLARE
  i INT;
  expense_id UUID;
BEGIN
  FOR i IN 1..100 LOOP
    -- 출장 정보 추가
    INSERT INTO business_expenses (user_email, name, start_date, end_date, purpose)
    VALUES ('performance@example.com', '성능 테스트 ' || i, 
            CURRENT_DATE - (i % 30), CURRENT_DATE - (i % 30) + 2, '성능 테스트')
    RETURNING id INTO expense_id;
    
    -- 교통비 추가 (각 출장당 3개)
    FOR j IN 1..3 LOOP
      INSERT INTO expense_transportation (expense_id, date, type, amount)
      VALUES (expense_id, CURRENT_DATE - (i % 30) + j - 1, 
              CASE j WHEN 1 THEN 'taxi' WHEN 2 THEN 'flight' ELSE 'fuel' END, 
              10000 * j);
    END LOOP;
    
    -- 숙박비 추가
    INSERT INTO expense_accommodations (expense_id, start_date, end_date, type, hotel_name, total_amount)
    VALUES (expense_id, CURRENT_DATE - (i % 30), CURRENT_DATE - (i % 30) + 1, 'hotel', '호텔 ' || i, 100000);
  END LOOP;
END $$;

-- 성능 측정
EXPLAIN ANALYZE
SELECT * FROM expense_summary 
WHERE user_email = 'performance@example.com';

EXPLAIN ANALYZE
SELECT * FROM get_user_expenses('performance@example.com');


7. 롤백 계획 준비
문제 발생 시 롤백할 수 있는 스크립트를 준비합니다:

-- 롤백 스크립트 예시
DROP FUNCTION IF EXISTS get_user_expenses;
DROP VIEW IF EXISTS expense_summary;
DROP TRIGGER IF EXISTS set_registration_number ON business_expenses;
DROP FUNCTION IF EXISTS generate_registration_number;

-- 테이블 롤백 (필요시)
-- DROP TABLE expense_entertainment;
-- DROP TABLE expense_accommodation_breakfasts;
-- DROP TABLE expense_accommodations;
-- DROP TABLE expense_transportation;
-- DROP TABLE expense_visits;
-- DROP TABLE business_expenses;

애플리케이션 레벨 테스트
데이터베이스 변경이 애플리케이션에 미치는 영향도 확인해야 합니다:
API 엔드포인트 테스트: Postman이나 Insomnia 같은 도구로 API 호출 테스트
프론트엔드 통합 테스트: 실제 UI에서 데이터 입력 및 조회 테스트
자동화된 테스트: 단위 테스트, 통합 테스트 실행

모니터링 설정
장기적인 관점에서 데이터베이스 성능을 모니터링합니다:
쿼리 성능 모니터링: Supabase의 쿼리 로그 확인
인덱스 사용 현황: 실행 계획(EXPLAIN ANALYZE)을 통한 인덱스 사용 확인
데이터 증가에 따른 성능 변화: 정기적인 성능 테스트
이러한 방법들을 통해 데이터베이스 업데이트가 제대로 적용되었는지 체계적으로 확인할 수 있습니다. 단순히 데이터가 잘 들어가는지 확인하는 것보다 더 포괄적인 검증이 가능합니다.