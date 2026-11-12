import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  directorate: text("directorate").notNull(),
  role: text("role").notNull(),
  manager: text("manager"),
  password: text("password").notNull(),
  mustChange: integer("must_change").notNull().default(1),
  active: integer("active").notNull().default(1),
  failures: integer("failures").notNull().default(0),
  lockedUntil: integer("locked_until").notNull().default(0),
  email: text("email"),
  notify: text("notify").notNull().default("instant"),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expires: integer("expires").notNull(),
});
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(1),
});
export const outbox = sqliteTable("outbox", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  eventKey: text("event_key").notNull(),
  proposalId: text("proposal_id"),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: integer("sent_at"),
});
export const kv = sqliteTable("kv", {
  k: text("k").primaryKey(),
  v: text("v").notNull(),
});
