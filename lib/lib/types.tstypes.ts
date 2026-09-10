// 项目共享的类型定义。
// 新模块（GSC数据、审计问题等）如果需要新类型，也统一加在这个文件里，
// 不要在各自的组件文件里各自定义相似的类型。

/** 关键词分类结果。规则引擎和AI语义判断最终都归到这几类里 */
export type KeywordCategory =
  | "pending" // 还没处理
  | "relevant" // 保留：与业务相关，适合作为SEO目标词
  | "competitor" // 竞品词：命中竞品品牌名单
  | "negative" // 已排除：命中人工设置的排除规则词
  | "irrelevant" // 不相关：AI判断为主题不符
  | "uncertain"; // 待复核：AI也无法判断，需要人工看

/** 关键词行，对应 Supabase 的 keywords 表 */
export interface KeywordRow {
  id: string;
  keyword: string;
  seed_topic: string | null;
  category: KeywordCategory;
  search_volume: number | null;
  kd: number | null;
  cpc: number | null;
  reason: string | null;
  source: string | null;
  created_at?: string;
}

/** 前端组件里使用的关键词形状（字段名更贴近UI，volume而不是search_volume） */
export interface KeywordUiRow {
  id: string;
  keyword: string;
  volume: number | null;
  kd: number | null;
  cpc: number | null;
  category: KeywordCategory;
  reason: string;
}

/** /api/classify 接口返回的单条分类结果 */
export interface ClassifyResultItem {
  i: number;
  c: "relevant" | "irrelevant" | "uncertain";
  n: string;
}

/** /api/classify 接口的请求体 */
export interface ClassifyRequest {
  topic: string;
  batch: { keyword: string }[];
}
