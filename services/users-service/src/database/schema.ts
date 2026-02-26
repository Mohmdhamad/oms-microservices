import { pgTable, uuid, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('customer'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    firstNameIdx: index('users_first_name_idx').on(table.firstName),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
