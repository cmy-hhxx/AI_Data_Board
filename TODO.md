# TODO

> 目标: 只执行 `todo-raw.md` 这一轮新增/待修复需求。上一版本已经实现的搭建型内容不要再重复执行。
> 使用方式: `/goal` 只扫描 `<!-- TASKS_START -->` 与 `<!-- TASKS_END -->` 之间的编号任务区；每个 `####` 是一个可独立交付的任务。

---

## 执行协议

- parent agent 负责读上下文、维护 TODO 状态、执行轻量任务、验证 typecheck/build。
- 重量任务交给 subagent；每个 subagent 只处理一个 `####` 子项，完成后必须更新根目录 `handoff.md`。
- 标记 `[x]` 前必须跑对应验收命令；无法运行时说明原因并保留 `[ ]`。
- 只做当前需求的最小改动；不要恢复或重做上一版本已完成内容。
- 需要决策时，agent 按“快速分发任务、低复杂度、可维护”的目标自行选择最优方案，并记录取舍。

### Handoff 格式

重量任务完成后，subagent 必须覆盖/更新根目录 `handoff.md`：

```markdown
# Handoff

## 任务
- TODO 子项: 1.4 修复同列拖拽卡顿
- 执行者: subagent

## 新增/修改的文件
- frontend/src/components/board/BoardView.tsx
- frontend/src/components/board/BoardColumn.tsx

## 行为变化
- 同列拖拽排序更流畅
- reorder 失败时重新拉取任务，避免本地顺序错误

## 验证结果
- pnpm --filter frontend typecheck: pass

## 待确认事项
- [ ] 无
```

---

## 当前需求拆解

<!-- TASKS_START -->

### 1. 看板基础 Bug 与任务流修复

#### 1.1 [轻量][parent] 修复总览页 `<button>` 嵌套 `<button>` DOM 错误

- [x] 修改 `frontend/src/components/board/OverviewView.tsx` 中项目卡片结构，消除外层 button 内嵌删除 button。
- [x] 保留点击项目进入看板、删除按钮 hover 显示、删除确认弹窗。
- [x] 删除按钮点击不能触发进入项目。
- [x] 如外层改为 `div role="button"`，补齐 Enter/Space 键盘进入项目。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** 控制台不再出现 `In HTML, <button> cannot be a descendant of <button>`；项目进入和删除都可用。

#### 1.2 [轻量][parent] 让任务可以删除

- [x] 在 `BoardView.tsx` 增加 `handleDeleteTask(taskId)`，调用 `api.tasks.delete(currentProjectId, taskId)`。
- [x] 删除成功后 dispatch `REMOVE_TASK`。
- [x] 在 `BoardColumn.tsx` 把真实删除回调传给 `TaskCard`，不要再传空函数。
- [x] 在 `TaskCard.tsx` 增加删除入口，建议放在展开态，删除前确认。
- [x] 删除按钮点击不能触发拖拽或卡片展开。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** UI 中可以删除任务；刷新后任务仍不存在。

#### 1.3 [轻量][parent] 去掉任务标签功能入口

- [x] 从 `TaskCard.tsx` 移除标签展示、新建标签、选择标签、`tagIds` 保存逻辑。
- [x] 从 `BoardColumn.tsx`、`BoardView.tsx` 移除只服务标签 UI 的 `tags` / `onTagCreated` props。
- [x] 从 `App.tsx` 移除启动时 `api.tags.list()`。
- [x] 从 `useRealtime.ts` 移除数据库变化后刷新 tags。
- [x] 如 `BoardContext.tsx` 的 tags state/action 已无引用，一并删除。
- [x] 后端 tags 表和路由暂不删除，避免无关数据库迁移。

**验收命令:**

```bash
pnpm --filter frontend typecheck
pnpm --filter shared typecheck
```

**完成条件:** 前端不再展示、创建、选择任务标签，也不主动请求 `/api/tags`。

#### 1.4 [重量][subagent] 修复同一列内拖拽任务卡顿

- [x] 审查 `BoardView.tsx`、`BoardColumn.tsx`、`TaskCard.tsx` 的 dnd-kit 使用方式。
- [x] 修复同列排序本地状态：拖拽结束后，同列受影响任务的 `position` 必须同步更新，而不是只改 active task。
- [x] 降低拖拽事件冲突：展开态表单控件不应触发拖拽；必要时把 drag listeners 收敛到卡片非编辑区域或拖拽手柄。
- [x] reorder API 失败时记录错误，并重新拉取当前项目任务，避免本地顺序永久错误。
- [x] 不更换拖拽库，不做大重构。
- [x] 更新 `handoff.md`。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** 同列上下拖拽不卡顿，松手后顺序稳定；刷新后顺序一致；跨列拖拽仍可用。

#### 1.5 [轻量][parent] 新建项目默认列去掉“审核中”

- [x] 修改 `backend/src/routes/projects.ts` 的 `DEFAULT_COLUMNS`。
- [x] 新建项目默认列只保留：`待分配`、`进行中`、`紧急通道`、`已完成`。
- [x] 保持项目和默认列在同一个 `db.transaction()` 中创建。
- [x] 不删除既有项目里的“审核中”列，只影响新项目。

**验收命令:**

```bash
pnpm --filter backend typecheck
```

**完成条件:** 新建项目只生成 4 列，没有“审核中”。

#### 1.6 [轻量][parent] 修复任务重复创建与编辑任务 400

- [x] 在 `BoardColumn.tsx` 的新增任务表单增加提交中状态，Enter 和按钮点击不能并发创建两次。
- [x] 提交中禁用添加按钮；保留 Escape 取消。
- [x] 在 `backend/src/routes/tasks.ts` 拆分 create/update schema。
- [x] update schema 必须允许 `columnId`、`assignee`、`startDate`、`endDate` 为 `null`，与 `shared/src/types/task.ts` 的 `UpdateTaskInput` 一致。
- [x] 确认清空指派人时发送 `assignee: null` 不再触发 `PUT ... 400`。

**验收命令:**

```bash
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

**完成条件:** 快速按 Enter/点击不会重复创建任务；编辑任务清空负责人不再 400。

---

### 2. 全部人员时间线改造

#### 2.1 [重量][subagent] 把现有时间线修正为全项目人员工作总览

- [x] 基于现有 `backend/src/routes/timeline.ts`、`frontend/src/components/board/PersonnelTimeline.tsx`、`frontend/src/lib/api.ts` 修改，不重做上一版本的 API/组件搭建。
- [x] 确认 `GET /api/timeline` 聚合所有项目，不按当前项目隔离。
- [x] 前端展示以”全部人员工作总览”为核心，而不是单项目视角。
- [x] 信息结构建议为：人员 -> 项目 -> 任务，或项目 -> 人员 -> 任务；选择更利于全局资源观察的一种，并保持交互清晰。
- [x] 任务无起止日期时仍应在列表/树中可见，但不强行渲染时间条。
- [x] tooltip 或详情区展示：任务标题、项目、负责人、优先级、所在列、起止日期。
- [x] 删除仅用于调试的 `console.log` 点击行为，任务点击应高亮、定位或展示详情。
- [x] 更新 `handoff.md`。

**验收命令:**

```bash
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
```

**完成条件:** 总览页时间线展示所有项目汇总后的人员工作情况；不依赖当前项目；任务点击和 tooltip 有实际信息价值。

#### 2.2 [重量][subagent] 优化时间线视觉：科技感、信息量、克制

- [x] 保留 ECharts，不新增图表库。
- [x] 右侧时间线支持水平日期轴和 `dataZoom`。
- [x] 左侧人员/项目/任务结构与右侧图表联动：展开、筛选或选中状态会影响图表或详情。
- [x] 视觉风格使用中性色、细边框、低饱和优先级色；不要大面积渐变、装饰光效、花哨动画。
- [x] 提升信息密度：同屏能看见足够多人员和任务，但文本不能重叠或溢出。
- [x] 空数据、无排期任务、加载失败都有清晰占位。
- [x] 更新 `handoff.md`。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** 时间线看起来像一个高效工作总览面板，有科技感但不花哨；交互和空状态可用。

---

### 3. 项目推进进度可视化面板

#### 3.1 [重量][subagent] 为任务增加”卡点”数据闭环

- [x] 在 `backend/src/db/schema.ts` 的 `tasks` 表增加一个文本字段，命名优先使用 `blocker`，允许 `null`。
- [x] 生成对应 Drizzle migration：`pnpm --filter backend db:generate`。
- [x] 更新 `shared/src/types/task.ts` 的 `Task`、`CreateTaskInput`、`UpdateTaskInput`。
- [x] 更新 `backend/src/routes/tasks.ts` 的 create/update schema，允许保存和清空 `blocker`。
- [x] 不新增评论表、历史记录表或复杂流转表；第一版只保存当前卡点说明。
- [x] 更新 `handoff.md`。

**验收命令:**

```bash
pnpm --filter shared typecheck
pnpm --filter backend typecheck
```

**完成条件:** 任务可以通过 API 保存、更新、清空卡点文本；数据库、后端、shared 类型一致。

#### 3.2 [重量][subagent] 把项目进度页改成高效率交互式推进面板

- [x] 基于现有 `frontend/src/components/board/ProgressView.tsx` 修改。
- [x] 只展示当前项目的推进情况，不做全项目混排。
- [x] 面板至少包含：
  - 完成进度：已完成任务数 / 总任务数、完成率。
  - 流程分布：按当前项目列统计任务数。
  - 风险区：紧急任务、有卡点任务、逾期未完成任务。
  - 任务推进列表：标题、负责人、优先级、所在列、起止日期、卡点摘要。
- [x] 任务详情或行内编辑支持负责人标注/编辑卡点。
- [x] 支持选择推进流程：把任务移动到当前项目的其他列。
- [x] 移动列使用现有任务更新 API，不绕过后端。
- [x] 日期甘特视图如保留，只作为辅助，不作为唯一信息表达。
- [x] 更新 `handoff.md`。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** 进入某项目的“进度”视图后，可以快速看到进度、风险和卡点，并能直接编辑卡点、推动任务流转。

#### 3.3 [轻量][parent] 推进面板体验收尾

- [x] 保持界面克制：中性色为主，优先级颜色只做小面积提示。
- [x] 窄屏下任务标题、按钮、列选择器不能溢出或重叠。
- [x] 所有 icon button 必须有 `title` 或可读标签。
- [x] 空任务、无卡点、无逾期任务都有清晰占位。

**验收命令:**

```bash
pnpm --filter frontend typecheck
```

**完成条件:** 推进面板紧凑、可读、无明显布局问题。

---

### 4. 最终验收

#### 4.1 [轻量][parent] 全仓类型检查与构建

- [x] 运行 shared、backend、frontend typecheck。
- [x] 运行根构建命令。
- [x] 只修复本轮需求引入的问题，不做无关重构。

**验收命令:**

```bash
pnpm --filter shared typecheck
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm build
```

**完成条件:** typecheck 和 build 全部通过。

#### 4.2 [轻量][parent] TODO 与 handoff 状态同步

- [x] 把实际已完成子项标记为 `[x]`。
- [x] 确认每个重量任务都有 `handoff.md` 交接记录。
- [x] 对照 `todo-raw.md` 的 8 条，确认没有遗漏。

**验收命令:**

```bash
rg -n "^- \\[ \\]" TODO.md
```

**完成条件:** TODO 状态与实际实现一致，剩余未完成项清晰可见。

<!-- TASKS_END -->

---

## `/goal` 命令提示词

```text
/goal
按 TODO.md 执行，混合调度。

执行方式：
1. read_file TODO.md
2. 定位任务扫描范围：
   - 只扫描 `<!-- TASKS_START -->` 与 `<!-- TASKS_END -->` 之间的内容。
   - 忽略 fenced code block 内的所有文本。
   - 忽略 Handoff 格式、/goal 提示词、原始需求覆盖映射、明确不做等说明区。
3. 找到待执行批次列表：
   - 只把形如 `^### [0-9]+\\. ` 的标题视为批次。
   - 从上到下找出所有仍包含未完成 `####` 的 `###` 批次。
   - 未完成 `####` 的判定：该 `####` 标题到下一个 `####`/`###` 之间，存在行首匹配 `- [ ] ` 的 checklist。
   - 从第一个未完成批次开始连续执行，直到 `TASKS_START/TASKS_END` 范围内没有任何未完成 `####`。
4. 对每个待执行批次，用 todo_write 注册该批次下所有未完成的 `####` 子项：
   - todo item 标题使用完整 `####` 标题，例如 `1.4 [重量][subagent] 修复同一列内拖拽任务卡顿`。
   - 不要把 `####` 内部的每一条 checklist 单独注册为 todo item；它们只是该子项的验收细则。
   - 已经完全 `[x]` 的 `####` 不注册。
   - 一个批次完成后，重新读取 TODO.md，重新扫描剩余批次，再继续下一个批次，避免基于过期状态执行。
5. 先做 plan，再做开发：
   - 每进入一个 `###` 批次，都先读取该批次涉及的源文件和最近的 handoff.md（如果存在）。
   - 写出该批次执行计划，至少包含：子项顺序、parent/subagent 分工、每个子项责任文件、验收命令、潜在风险。
   - 如果发现 TODO 与现有代码不一致，先在计划里说明采用的最小修正策略，再开始改代码。
   - 计划完成前不要 edit_file/apply_patch，不要 spawn subagent。
6. plan 确认后再进入开发，根据 `####` 标题标签选择执行方式：

[轻量任务][parent]
- parent 直接执行。
- 标准流程：
  a. read_file 现状
  b. apply_patch 做最小必要修改
  c. 运行该子项验收命令
  d. 通过后把该子项下的 `- [ ]` 改为 `- [x]`

[重量任务][subagent]
- spawn subagent 执行，一个 subagent 只处理一个 `####` 子项。
- parent 给 subagent 的 prompt 必须包含：
  - 负责的 TODO 子项编号和标题
  - 相关源文件路径
  - 子项验收命令
  - “你不独占仓库，不能回滚他人改动”
  - “只改该子项需要的文件，不做无关重构”
  - “完成后必须更新根目录 handoff.md”
- subagent 返回后，parent 读取 handoff.md 和 diff，运行验收命令。
- 验收不通过时，parent 小修；若仍是该重量任务核心问题，让同一个 subagent 继续修。
- 验收通过后把该子项下的 `- [ ]` 改为 `- [x]`。

硬约束：
- parent 始终维护 typecheck 通过。
- 不重做上一版本已完成的 API/组件/依赖搭建。
- 不恢复任务标签 UI。
- 新建项目默认列不得包含“审核中”。
- 时间线必须是所有项目汇聚后的人员工作总览，不得按当前项目隔离。
- 推进面板第一版只需要当前卡点字段，不做评论流或复杂历史。
- 每个重量任务完成后必须有 handoff.md；没有 handoff 不得标记完成。
- 单个 `###` 批次全部 `[x]` 后，不要停止；输出简短批次摘要，然后继续扫描并执行下一个未完成批次。
- 只有当 TODO.md 中 `TASKS_START/TASKS_END` 范围内所有 `####` 子项都完成并通过最终验收后，才输出最终完成摘要并停止。
- 如果遇到真实阻塞导致无法继续，保留相关 `[ ]`，说明阻塞、已完成内容、失败命令和下一步最小修复建议。
```

---

## 原始需求覆盖映射

- `todo-raw.md` 1: 对应 1.1。
- `todo-raw.md` 2: 对应 1.2。
- `todo-raw.md` 3: 对应 1.3。
- `todo-raw.md` 4: 对应 1.4。
- `todo-raw.md` 5: 对应 1.5。
- `todo-raw.md` 6: 对应 1.6。
- `todo-raw.md` 7: 对应 2.1、2.2。
- `todo-raw.md` 8: 对应 3.1、3.2、3.3。

## 明确不做

- 不重建上一版本已经存在的时间线 API、ECharts 依赖或基础组件。
- 不新增用户管理页面。
- 不物理删除 tags / task_tags 表。
- 不删除既有项目中的“审核中”列，只改变新建项目默认列。
- 不做任务评论流、复杂审批流或流程历史表。
