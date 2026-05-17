import { pgTable, uuid, text, integer, date, pgEnum, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'urgent'])
export const attachmentTypeEnum = pgEnum('attachment_type', ['file', 'link', 'image', 'code'])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const boardColumns = pgTable('board_columns', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  columnId: uuid('column_id').references(() => boardColumns.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  priority: priorityEnum('priority').default('medium'),
  position: integer('position').notNull().default(0),
  assignee: text('assignee'),
  dueDate: date('due_date'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
})

export const taskTags = pgTable('task_tags', {
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.taskId, t.tagId] }),
}))

export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: attachmentTypeEnum('type').notNull(),
  url: text('url'),
  content: text('content'),
  size: integer('size'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
