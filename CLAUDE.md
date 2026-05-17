# AI Data Board — 项目速查

pnpm monorepo，三个包：`frontend` / `backend` / `shared`

## 关键入口

| 文件 | 作用 |
|---|---|
| `backend/src/index.ts` | Hono 服务入口，注册路由和中间件 |
| `backend/src/db/schema.ts` | 6 张表的 Drizzle schema |
| `backend/src/routes/*.ts` | 每个文件一个路由组（projects/columns/tasks/tags/attachments） |
| `frontend/src/App.tsx` | React 根组件 |
| `frontend/src/contexts/BoardContext.tsx` | 全局状态（useReducer） |
| `frontend/src/lib/api.ts` | 类型安全 API 客户端 |
| `frontend/src/hooks/useRealtime.ts` | Supabase Realtime 订阅 |
| `shared/src/index.ts` | 类型 + 日志导出入口 |
| `shared/src/types/` | board / project / task 类型定义 |

## 数据模型关系

```
projects ──→ board_columns
    │
    └──→ tasks ──→ attachments
              │
              └──→ tags (多对多 via task_tags)
```

## 前端组件树

```
App → BoardProvider (Context)
        └─ AppContent
              ├─ Sidebar (项目导航)
              └─ BoardView (DndContext)
                     ├─ BoardColumn (droppable)
                     │     └─ TaskCard (sortable)
                     └─ TaskDetailDialog
```
