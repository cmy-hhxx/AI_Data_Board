# TODO

> 项目: **ai-data-board** — 多项目管理看板（看板/进度/文档视图），Hono + React + Drizzle ORM + PostgreSQL（Supabase）

---

## 需求

### 总览页面重构

#### 1.1 简化项目卡片样式 & 添加删除功能

- [ ] 移除项目卡片上的彩色装饰元素（顶部彩色横条、彩色头像背景、彩色进度条），改用纯灰色/中性色表达
- [ ] 使用 `ui-ux-pro-max` skill 确定克制调色板（全局不超过 5 种颜色），只在优先级标签等必要处使用颜色
- [ ] 项目卡片布局精简: 项目名称（左侧）+ 任务数 + hover 时右侧出现 `→` 箭头 + 左上角 hover 出现删除按钮
- [ ] 添加删除确认弹窗（防止误删），调用 `api.projects.delete(id)`
- [ ] 项目卡片不再显示 `PROJECT_COLORS` 随机分配的颜色轮询

**完成条件:** 总览页项目卡片为中性色调（无彩色装饰）；hover 时显示删除按钮点击可删除（带确认弹窗）；全局颜色使用 ≤ 5 种。

#### 1.2 移除总览页的任务列表

- [ ] 删除 `OverviewView.tsx` 中所有跨项目拉取 tasks 的逻辑（`projectTasks` state、`useEffect` 中 `api.tasks.list()` 调用）
- [ ] 删除任务聚合渲染代码（`allTasks` 排序、`visibleTasks` 渲染、TaskCard 展示、展开/收起按钮）
- [ ] 删除相关的优先级常量/标签/Judge 辅助函数（`PRIORITY_ORDER`、`PRIORITY_COLORS`、`PRIORITY_DOT` 等）—— 但 `OverviewView.tsx` 外部引用的保留

**完成条件:** 总览页不再发起任何 `/api/projects/:id/tasks` 请求；页面无任务列表渲染区域；tsc --noEmit 通过。

#### 1.3 创建项目时自动预设默认列

- [ ] 修改 `backend/src/routes/projects.ts` 中的 `POST /api/projects` handler:
  - 使用 `db.transaction()` 在创建项目后自动插入 5 个预设列:

    | 列名 | 说明 |
    |------|------|
    | 待分配 | 新任务待分配负责人 |
    | 进行中 | 正在执行的任务 |
    | 审核中 | 已完成但需验收/审核 |
    | 紧急通道 | 阻塞/紧急/需立即处理 |
    | 已完成 | 审核通过、已结项 |

  - 返回的 project 对象保持不变（无需包含 columns 信息）
- [ ] 前端 `OverviewView.tsx` 中创建项目后不再需要手动创建列 —— 但 1.1 的 `handleCreateProject` 无需改动（API 改动透明）

**完成条件:** 通过 API 或 UI 创建新项目后，`board_columns` 表自动写入 5 条预设列记录；项目的看板视图打开后直接显示这 5 列；用户后续可自行修改列名/排序/增删。

#### 1.4 添加人员时间线 API

- [ ] 新建 `backend/src/routes/timeline.ts`，注册为 `GET /api/timeline`
- [ ] 查询所有指派人（`tasks.assignee` 非 NULL 的用户）及其任务，返回结构:

```typescript
interface TimelineResponse {
  people: Array<{
    id: string
    name: string
    projects: Array<{
      id: string
      name: string
      color: string | null
      tasks: Array<{
        id: string
        title: string
        priority: Priority
        columnName: string    // 所在列名称
        startDate: string | null
        endDate: string | null
      }>
    }>
  }>
}
```

- [ ] 使用 Drizzle JOIN 查询（`tasks` → `users`、`projects`、`board_columns`），在应用层按 person → project → task 做聚合
- [ ] 注册到 `backend/src/index.ts`（`app.route('/api', timelineRouter)`）

**完成条件:** `curl /api/timeline` 返回按人聚合的任务数据，包含项目名/颜色、任务优先级/列名/日期；空数据时返回 `{ people: [] }`。

#### 1.5 安装 ECharts

- [ ] `pnpm --filter frontend add echarts`（安装 ECharts 核心库）
- [ ] 前端新增 `frontend/src/components/board/PersonnelTimeline.tsx`

**完成条件:** `echarts` 在 `frontend/package.json` 依赖中；可正常 `import * as echarts from 'echarts'`。

#### 1.6 实现人员时间线可视化组件

- [ ] 在 `OverviewView.tsx` 中，项目卡片区下方新增 `<PersonnelTimeline />` 区域
- [ ] `PersonnelTimeline.tsx` 实现:
  - 组件 mount 时调用 `fetch('/api/timeline')` 获取数据
  - **左侧树区**: 使用 ECharts `tree` 系列或 HTML `<details>` 组件渲染项目 → 人员 → 任务的层级树
    - 顶层: 项目名（可展开/收起）
    - 二层: 项目下的人员名（显示任务数）
    - 三层: 任务标题（点击可跳转/高亮）
  - **右侧时间线区**: 使用 ECharts 渲染水平甘特图条
    - Y 轴: 人员名单（分组对齐左侧树结构）
    - X 轴: 日期时间轴（支持 `dataZoom` 拖拽缩放）
    - 每个任务渲染为一条水平色条（按优先级着色），位置从 `startDate` 到 `endDate`
  - 树节点展开/收起时，时间线图表联动更新
  - 空数据时显示 "暂无人员时间线数据" 占位
  - 使用 ECharts `tooltip` 展示任务详情（标题、项目、优先级、起止日期）

**完成条件:** 总览页下半区展示可交互的树形时间线可视化；树展开收起 → 图表联动；dataZoom 可缩放日期范围；tooltip 悬浮显示任务详情。

---

### 任务卡片优化

#### 2.1 隐藏用户身份信息

- [ ] `TaskCard.tsx` assignee `<select>` 中，`<option>` 展示只显示 `u.name`，不显示 `(u.role)`（当前第 199 行 `{u.name} ({u.role})` → `{u.name}`）
- [ ] 全局搜索 `u.role` / `user.role` / `role` 在前端组件中的渲染，确保无角色信息暴露

**完成条件:** 前端任意页面的用户选择器/标签中不再显示 `(supervisor)`、`(pm)` 等角色后缀；用户 API 仍返回 `role` 字段（后端使用），前端仅忽略渲染。

---

### UI 风格统一

#### 3.1 调色板克制化（ui-ux-pro-max 指导）

- [ ] 运行 `ui-ux-pro-max` skill 审查当前配色方案，确定 ≤ 5 种颜色的调色板
- [ ] 应用范围:
  - 优先级标签（当前 4 色 + 灰 = 5 色，在限额内可保留但降低饱和度/面积）
  - 项目卡片（去掉项目自带的彩色，仅用中性色 + 统一 accent）
  - 看板列标题（去掉 `column.color` 个性化颜色）
  - 树形时间线中的任务条按优先级着色（复用优先级颜色）
- [ ] 更新 `frontend/src/index.css` 中的 Tailwind 自定义色值（如需要）

**完成条件:** 页面全局颜色种类 ≤ 5（黑白灰中性色不算）；优先级标签/任务条颜色柔和克制；无突兀的高饱和色块。

---

## 不做的范围（明确边界）

- **不做** 用户管理前端页面（已有明确的 `不做` 决定，无 CRUD/列表/路由）
- **不做** 红色/蓝色主题切换、不做大幅布局重排
- **不做** 后端用户 API 移除 `role` 字段（前端仅不渲染，保留 `role` 供后端/种子脚本使用）
- **不做** 阻止用户修改/删除预设列——预设仅作为初始状态，用户完全控制
- **不做** 将 `OverviewView` 拆分为独立页面或路由——仍作为 `App.tsx` 中的 `state.currentProjectId === null` 时的显示
- **不做** 人员时间线的实时更新（Realtime）——初始版本仅在页面加载/刷新时拉取
- **不做** 从项目中移除 `color` 字段——保留以支持未来扩展，仅前端减少使用
