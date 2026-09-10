import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase 环境变量未配置：请检查 .env.local（本地开发）或 Vercel 项目的 Environment Variables（线上部署）"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
