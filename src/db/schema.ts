import { integer, pgTable, varchar, date } from "drizzle-orm/pg-core";

export const productsTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  price: integer().notNull(),
  image: varchar({ length: 255 }).notNull(),
  brand: varchar({ length: 255 }).notNull(),
  category: varchar({ length: 255 }).notNull(),
  createdAt: date().defaultNow().notNull(),
});
