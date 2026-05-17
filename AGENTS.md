# AI Data Board — 操作速查

## 改数据库表
1. 编辑 `backend/src/db/schema.ts`
2. `pnpm --filter backend db:generate` → 生成迁移
3. `pnpm --filter backend db:migrate` → 执行迁移

## 加 API 路由
1. `backend/src/routes/` 下新建 `.ts`，导出 Hono Router
2. 在 `backend/src/index.ts` 用 `app.route('/api/xxx', router)` 注册

## 加前端组件
1. 组件放 `frontend/src/components/` 下按功能分类
2. 全局状态用 `BoardContext` 的 `dispatch` 读写
3. API 调用通过 `lib/api.ts` 的 `api` 对象

## 改共享类型
- `shared/src/types/` 下对应文件，前后端自动引用

## 关键命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动前后端 |
| `pnpm build` | 构建全部包 |
| `pnpm --filter <pkg> typecheck` | 类型检查某包 |
