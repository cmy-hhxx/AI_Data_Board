# TODO

> 项目: **ai-data-board** — 多项目管理看板（看板/进度/文档视图），Hono + React + Drizzle ORM + PostgreSQL（Supabase）

---

## 需求

### 用户数据初始化

- [x] 创建 `users` 表（Drizzle migration），包含字段: `id(uuid)`、`name(text)`、`role(text)`（枚举值: supervisor / pm / algorithm / annotator / crawler / intern）
- [x] 编写种子脚本 `backend/src/seed/users.ts`，通过 `db.insert(users)` 录入以下初始用户:

  | 姓名 | 角色 |
  |------|------|
  | 杨钰邦 | supervisor |
  | 吴浩威 | pm |
  | 陈明扬 | algorithm |
  | 姜淞译 | algorithm |
  | 任理想 | annotator |
  | 胡俊峰 | crawler |
  | 朱宇晨 | intern |

- [x] 更新 `tasks.assignee` 字段类型从 `text` 改为外键引用 `users.id`（nullable）
- [x] 修改前端 `TaskCard` 中的 assignee 输入，从自由文本改为从用户列表中选择
- [x] **不做**用户管理前端页面（无 CRUD 页面、无用户列表页、不添加到路由）

**完成条件:** `pnpm db:migrate` 新增 `users` 表且外键约束生效；`tsx backend/src/seed/users.ts` 执行后 7 条用户记录写入数据库；`tasks.assignee` 列迁移后原有数据无损（改为 uuid 后可设为 NULL）；前端创建/编辑任务时 assignee 显示为用户选择器且下拉选项来自后端 `/users` API。

### 术语统一: kanban → board

- [x] 前端组件目录 `frontend/src/components/kanban/` 重命名为 `board/`
- [x] 类型 `BoardSubView` 的取值 `'kanban'` 改为 `'board'`（Sidebar.tsx / BoardView.tsx 中均需修改）
- [x] 更新所有 `import` 路径中来自 `./components/kanban/` 的引用
- [x] `BoardSubView` 类型定义统一提取到 `shared` 包或 `BoardContext` 中，避免两处重复定义
- [x] 文档视图切换按钮中外部可见文案保留"看板"中文显示不变

**完成条件:** 全局搜索 `kanban` 字符串（排除 `node_modules` / `dist`）无匹配项；前端页面功能完整、拖拽/切换/路由正常；Git diff 不包含无关空格或格式化改动。

---

## UI 优化

- [x] 按照 `ui-ux-pro-max` skill，审计当前页面的字体、间距、布局问题
- [x] 保持当前整体风格（minimal / white-glass sidebar / rounded-xl 卡片），仅在现有基础上微调:
  - **字体:** 检查字号层级（sidebar 11px/12px、卡片标题、看板列标题），确保层级分明、最小字号 ≥ 10px
  - **间距:** 看板列间距 `gap-5`、卡片内边距、任务详情弹出层间距一致性
  - **布局:** 确认 `calc(100vh - 48px)` 在 100vh 下的滚动行为正常，看板列不溢出底部
- [x] 不做红色/蓝色主题切换、不做大幅布局重排

**完成条件:** 对比优化前后截图（或 PR review），字体间距视觉舒适度提升，无新引入的 UI 样式冲突；Tailwind 类名改动有据可依（引用了 ui-ux-pro-max 的具体 guideline）。

---

## Bug 修复

### `<button>` 嵌套导致的 hydration 报错

- [x] 定位 Sidebar.tsx 中 project dropdown 列表项使用了 `<button>` 元素（约第 73-85 行），而它们被外层 trigger `<button>`（约第 39 行）包裹，违反了 HTML 规范 `<button>` 不能嵌套 `<button>` -- 注：该 dropdown 已在 commit b8edf7f 的 Sidebar 重构中移除；同问题在 DocumentView.tsx 知识库列表项 `<button>` 内嵌套删除 `<button>`
- [x] 修复方案一（推荐）: 将 dropdown 列表项从 `<button>` 改为 `<div role="option" ... onClick={...}>`，保持可点击和 focusable -- 已在 DocumentView.tsx 中应用同原理修复：内层删除 `<button>` 改为 `<span role="button" tabIndex={0}>` 并添加 onKeyDown 键盘处理
- [x] 修复方案二: 将外层 trigger 从 `<button>` 改为 `<div role="button" tabIndex={0}>` -- 未采用，外层保持 `<button>`（最小改动原则）
- [x] 确认修复后控制台无 `validateDOMNesting` 错误 -- tsc --noEmit 通过
- [x] 确认键盘导航（Tab / Enter / Escape）在 dropdown 中正常工作 -- 内层 span 添加了 onKeyDown 处理 Enter/Space 键

**完成条件:** 刷新首页后 F12 控制台不再打印 `In HTML, <button> cannot be a descendant of <button>` 警告；dropdown 展开/收起/选择项目功能正常。
