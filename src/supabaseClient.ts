import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL 또는 Anon Key가 누락되었습니다. .env.local 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.'
  );
}

// 안전하게 폴백 값을 제공하여 키가 없어도 전체 앱이 크래시 나지 않도록 유도
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
);
