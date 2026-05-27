import { pgTable, uuid, text, integer, date, pgEnum, timestamp, unique } from 'drizzle-orm/pg-core'

export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'urgent'])
export const roleEnum = pgEnum('role', ['supervisor', 'pm', 'algorithm', 'annotator', 'crawler', 'intern'])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
})

export const boardColumns = pgTable('board_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id').references(() => boardColumns.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  priority: priorityEnum('priority').default('medium'),
  position: integer('position').notNull().default(0),
  startDate: date('start_date'),
  endDate: date('end_date'),
  blocker: text('blocker'),
  columnEnteredAt: timestamp('column_entered_at', { withTimezone: true }),
  estimatedDays: integer('estimated_days'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const taskAssignees = pgTable('task_assignees', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => ({
  uniqueTaskUser: unique('unique_task_user').on(t.taskId, t.userId),
}))

export const taskProgressNotes = pgTable('task_progress_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url'),
  content: text('content'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
