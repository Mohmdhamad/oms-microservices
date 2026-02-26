import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending',
  'confirmed',
  'released',
]);

// Warehouses table
export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Products table
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    sku: varchar('sku', { length: 100 }).notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    categoryId: uuid('category_id'),
    attributes: jsonb('attributes'),
    imageUrl: varchar('image_url', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
  })
);

// Inventory table
export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    productWarehouseIdx: uniqueIndex('inventory_product_warehouse_idx').on(
      table.productId,
      table.warehouseId
    ),
  })
);

// Inventory Reservations table
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index('inventory_reservations_order_id_idx').on(table.orderId),
    productIdIdx: index('inventory_reservations_product_id_idx').on(table.productId),
  })
);

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  inventory: many(inventory),
  reservations: many(inventoryReservations),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  inventory: many(inventory),
  reservations: many(inventoryReservations),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventory.warehouseId],
    references: [warehouses.id],
  }),
}));

export const inventoryReservationsRelations = relations(inventoryReservations, ({ one }) => ({
  product: one(products, {
    fields: [inventoryReservations.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventoryReservations.warehouseId],
    references: [warehouses.id],
  }),
}));

// Type exports
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;

export type InventoryReservation = typeof inventoryReservations.$inferSelect;
export type NewInventoryReservation = typeof inventoryReservations.$inferInsert;
