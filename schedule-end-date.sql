-- 우시시: 기간 일정의 종료일만 추가합니다.
-- 기존 데이터와 권한 정책은 변경하지 않습니다. 기존 NULL은 하루 일정입니다.
-- Supabase SQL Editor에서 한 번 실행한 뒤 관리자 페이지를 새로고침하세요.
ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS end_date DATE;
