CLAUDE.md — SGEO 项目说明书
这份文件是给"以后继续开发这个项目的人（包括AI）"看的架构约定。新增任何功能之前，先看这份文件，尽量复用已有的结构和封装，而不是自己另起一套写法。
项目是什么
SEO + GEO 数据整合系统。核心思路：确定性数据源和规则引擎优先，AI 只用在少数真正需要语义判断的地方（比如关键词是否与业务主题相关）。技术审计、排名趋势、内容衰减这类问题，用集合运算/阈值判断即可得出结论，不依赖 AI。
技术栈
Next.js 16（App Router）+ TypeScript
Supabase（Postgres）作为唯一数据存储
Claude API（`claude-sonnet-5`）仅在服务器端的 API 路由里调用，密钥不暴露给浏览器
部署在 Vercel
目录结构与约定
```
app/
  page.tsx                首页，模块导航入口。新增模块时在这里加一张卡片
  <module>/
    page.tsx              服务器组件外壳，只负责渲染客户端组件，不写业务逻辑
    <Module>.tsx          实际交互逻辑，客户端组件（"use client"）
  api/
    <name>/route.ts        服务器端接口。任何需要密钥（Anthropic、第三方API）的调用
                            必须放在这里，绝不能出现在客户端组件里
lib/
  types.ts                所有共享类型定义，新类型加在这里，不要在组件里各自定义
  supabaseClient.ts        Supabase 客户端初始化，唯一入口
  db.ts                    数据库读写的共享函数层。任何组件需要读写数据库，
                            调用这里的函数，不要在组件里直接写 supabase.from(...)
```
新增一个模块的标准步骤（比如以后加"GSC排名"模块）：
在 `lib/types.ts` 加对应的类型（比如 `GscPerformanceRow`）
在 `lib/db.ts` 加对应的读写函数（比如 `fetchGscPerformance()`）
如果需要调用外部API且涉及密钥，在 `app/api/<name>/route.ts` 写服务器端接口
在 `app/<module>/` 下建页面和组件，组件里只调用 `lib/db.ts` 的函数，不直接碰 Supabase
在 `app/page.tsx` 的模块列表里加一张卡片
数据库表（Supabase）
表名	用途	状态
`keywords`	关键词主数据，关键词分拣工具的数据	使用中
`gsc_performance`	GSC 每日排名/点击/展现数据	已建表，未接入
`ga4_metrics`	GA4 流量/转化数据	已建表，未接入
`audit_issues`	Screaming Frog 技术审计问题	已建表，未接入
`content_pages`	内容页面清单，用于衰减检测	已建表，未接入
`insights`	规则引擎产出的洞察/待办清单	已建表，未接入
`import_logs`	每次数据导入的记录	已建表，未接入
所有表已开启 RLS（Row Level Security），当前策略是"允许所有读写"（因为目前是单人使用）。如果以后要开放给多人使用，需要收紧成按用户隔离的策略。
环境变量
变量名	用途	是否公开
`NEXT_PUBLIC_SUPABASE_URL`	Supabase 项目地址	可暴露给浏览器（前缀 NEXT_PUBLIC_）
`NEXT_PUBLIC_SUPABASE_ANON_KEY`	Supabase 公开密钥	可暴露给浏览器
`ANTHROPIC_API_KEY`	Claude API 密钥	绝不能暴露，只在服务器端使用
代码风格约定
所有新文件用 TypeScript（`.ts` / `.tsx`），不再写 `.js` / `.jsx`
组件内部状态、函数参数尽量标注类型，不用 `any`
用 `@/lib/...` 这种路径别名导入共享模块，不用容易数错层级的相对路径（`../../../`）
分类/状态这类有限取值的字段，用联合类型（union type）而不是普通 string，参考 `lib/types.ts` 里的 `KeywordCategory`
设计取舍（为什么这么做）
为什么不是所有功能都用 AI：确定性判断用规则引擎，成本为零、结果可解释、不受模型不确定性影响
为什么 API 密钥要走服务器代理：前端代码在浏览器里完全公开可见，密钥写在前端会被任何人拿走滥用
为什么现在就上 TypeScript：项目还小，转换成本低；等文件多了再转，成本会高很多
为什么数据库读写封装成 `lib/db.ts` 而不是在组件里直接写：以后如果要换数据库、加缓存、加权限校验，只需要改一个文件，不用满项目找哪里调用过 Supabase
待办 / 已知简化
`lib/db.ts` 里 `saveKeywords` 目前是全量 upsert，没有做增量对比；数据量很大时可以优化成只更新变化的行
还没有自动化测试，核心流程（导入 -> 分拣 -> 保存）目前靠手动验收
权限策略（RLS）目前是"允许所有"，仅适合单人使用阶段
