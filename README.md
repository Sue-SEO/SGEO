# SGEO — SEO 与 GEO 数据整合系统

一个以"数据仓库 + 规则引擎"为核心的 SEO 工作台，AI 只用在少数需要语义判断的环节，而不是让每个功能都依赖大模型。

## 解决的问题

批量导出的关键词表（比如 Semrush 导出上万条词）里混杂着大量竞品品牌词和完全不相关的词，人工逐行筛选非常耗时。这个系统把筛选过程拆成两层：

1. **规则层**：竞品品牌名单、排除关键词规则，命中即分类，零成本、结果可解释、不依赖 AI。
2. **语义层**：规则筛不掉的部分，交给大模型判断是否与业务主题相关，用于处理规则无法覆盖的模糊case。

## 技术栈

- **前端 / 后端**：Next.js 14（App Router），同一个项目里既有页面也有 API 路由
- **数据库**：Supabase（托管 Postgres），存储关键词、分类结果、导入记录
- **AI**：Claude API（`claude-sonnet-5`），仅在 `/api/classify` 这一个服务器端接口里调用，密钥不暴露给浏览器
- **部署**：Vercel

## 目录结构

```
sgeo/
  app/
    page.js              首页，模块导航
    keywords/
      page.js            关键词分拣页面（服务器组件外壳）
      KeywordSorter.jsx   实际交互逻辑（客户端组件）
    api/
      classify/route.js  服务器端接口，安全调用 Claude API
    layout.js
    globals.css
  lib/
    supabaseClient.js     Supabase 客户端初始化
  package.json
  .env.local.example       环境变量模板
```

## 本地运行

1. 安装依赖：
   ```
   npm install
   ```
2. 复制环境变量模板并填入真实值：
   ```
   cp .env.local.example .env.local
   ```
   需要三个值：
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`：来自 Supabase 项目的 Settings → API Keys
   - `ANTHROPIC_API_KEY`：来自 [console.anthropic.com](https://console.anthropic.com)，只在服务器端使用，不会打包进浏览器代码
3. 启动开发服务器：
   ```
   npm run dev
   ```
   打开 http://localhost:3000

## 部署到 Vercel

1. 把这个项目推送到 GitHub 仓库
2. 在 Vercel 里 Import 这个仓库
3. 在 Vercel 项目的 Settings → Environment Variables 里添加上面三个环境变量（Production 环境）
4. 触发部署，几分钟后拿到线上地址

## 数据库表结构

在 Supabase 的 SQL Editor 里执行的建表语句见项目开发记录；核心表：

- `keywords`：关键词主数据，包含分类结果
- `gsc_performance` / `ga4_metrics`：规划中，用于自动拉取 Google Search Console / GA4 数据
- `audit_issues`：规划中，用于导入 Screaming Frog 技术审计报告
- `insights`：规划中，规则引擎产出的"待办清单"（内容衰减预警、快速提升机会等）

## 设计取舍

- **为什么不是所有功能都用 AI**：确定性数据（技术审计、排名趋势、内容衰减）用集合运算/阈值判断即可得出结论，成本为零、结果可解释、不受模型不确定性影响。AI 只用在关键词语义相关性这类真正需要理解语言的场景。
- **为什么 API 密钥要走服务器代理**：前端代码在浏览器里是完全公开可见的，任何密钥写在前端都会被任何人拿到并滥用计费。所有需要密钥的调用都封装成服务器端的 API 路由。
