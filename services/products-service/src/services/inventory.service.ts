import { db } from '../database/client';
import {
  inventory,
  inventoryReservations,
  type Inventory,
  type NewInventory,
  type InventoryReservation,
  type NewInventoryReservation,
} from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger, NotFoundError, ValidationError } from '@oms/toolkit';
import { ProductEventPublisher } from '../events/publisher';
import { createInventoryReservedEvent } from '../events/inventory-reserved.event';
import { createInventoryInsufficientEvent } from '../events/inventory-insufficient.event';

interface ReserveInventoryData {
  productId: string;
  warehouseId: string;
  quantity: number;
  orderId: string;
}

interface ReleaseInventoryData {
  productId: string;
  warehouseId: string;
  quantity: number;
  orderId: string;
}

interface BatchUpdateData {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export class InventoryService {
  constructor(private eventPublisher: ProductEventPublisher) {}

  async update(productId: string, warehouseId: string, quantity: number): Promise<Inventory> {
    try {
      logger.info({ productId, warehouseId, quantity }, 'Updating inventory');

      // Check if inventory record exists
      const existing = await db.query.inventory.findFirst({
        where: and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId)),
      });

      if (existing) {
        // Update existing inventory
        const [updated] = await db
          .update(inventory)
          .set({
            quantity,
            updatedAt: new Date(),
          })
          .where(
            and(eq(inventory.productId, productId), eq(inventory.warehouseId, warehouseId))
          )
          .returning();

        logger.info({ productId, warehouseId }, 'Inventory updated successfully');
        return updated;
      } else {
        // Create new inventory record
        const [created] = await db
          .insert(inventory)
          .values({
            productId,
            warehouseId,
            quantity,
          })
          .returning();

        logger.info({ productId, warehouseId }, 'Inventory created successfully');
        return created;
      }
    } catch (error) {
      logger.error({ error, productId, warehouseId }, 'Failed to update inventory');
      throw error;
    }
  }

  async reserve(data: ReserveInventoryData): Promise<void> {
    try {
      logger.info(
        { orderId: data.orderId, productId: data.productId, quantity: data.quantity },
        'Reserving inventory'
      );

      await db.transaction(async (tx) => {
        // Get current inventory
        const inventoryRecord = await tx.query.inventory.findFirst({
          where: and(
            eq(inventory.productId, data.productId),
            eq(inventory.warehouseId, data.warehouseId)
          ),
        });

        if (!inventoryRecord) {
          throw new NotFoundError(
            'Inventory',
            `${data.productId}:${data.warehouseId}`
          );
        }

        // Calculate available quantity (considering existing reservations)
        const [{ reservedQuantity }] = await tx
          .select({
            reservedQuantity: sql<number>`COALESCE(SUM(${inventoryReservations.quantity}), 0)::int`,
          })
          .from(inventoryReservations)
          .where(
            and(
              eq(inventoryReservations.productId, data.productId),
              eq(inventoryReservations.warehouseId, data.warehouseId),
              eq(inventoryReservations.status, 'pending')
            )
          );

        const availableQuantity = inventoryRecord.quantity - reservedQuantity;

        // Check if sufficient inventory available
        if (availableQuantity < data.quantity) {
          logger.warn(
            {
              orderId: data.orderId,
              productId: data.productId,
              requested: data.quantity,
              available: availableQuantity,
            },
            'Insufficient inventory'
          );

          // Publish inventory.insufficient event
          const event = createInventoryInsufficientEvent({
            orderId: data.orderId,
            productId: data.productId,
            warehouseId: data.warehouseId,
            requestedQuantity: data.quantity,
            availableQuantity,
            reason: `Only ${availableQuantity} units available, but ${data.quantity} requested`,
          });

          await this.eventPublisher.publishEvent(event, 'inventory.insufficient');
          return;
        }

        // Create reservation
        await tx.insert(inventoryReservations).values({
          orderId: data.orderId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          status: 'pending',
        });

        logger.info({ orderId: data.orderId, productId: data.productId }, 'Inventory reserved');

        // Publish inventory.reserved event
        const event = createInventoryReservedEvent({
          orderId: data.orderId,
          productId: data.productId,
          warehouseId: data.warehouseId,
          quantity: data.quantity,
          reservedAt: new Date().toISOString(),
        });

        await this.eventPublisher.publishEvent(event, 'inventory.reserved');
      });
    } catch (error) {
      logger.error({ error, orderId: data.orderId }, 'Failed to reserve inventory');
      throw error;
    }
  }

  async release(data: ReleaseInventoryData): Promise<void> {
    try {
      logger.info(
        { orderId: data.orderId, productId: data.productId, quantity: data.quantity },
        'Releasing inventory'
      );

      await db.transaction(async (tx) => {
        // Find all pending reservations for this order and product
        const reservationsToRelease = await tx.query.inventoryReservations.findMany({
          where: and(
            eq(inventoryReservations.orderId, data.orderId),
            eq(inventoryReservations.productId, data.productId),
            eq(inventoryReservations.status, 'pending')
          ),
        });

        if (reservationsToRelease.length === 0) {
          logger.warn(
            { orderId: data.orderId, productId: data.productId },
            'No pending reservations found to release'
          );
          return;
        }

        // Update reservation status to 'released'
        await tx
          .update(inventoryReservations)
          .set({
            status: 'released',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventoryReservations.orderId, data.orderId),
              eq(inventoryReservations.productId, data.productId),
              eq(inventoryReservations.status, 'pending')
            )
          );

        logger.info(
          { orderId: data.orderId, productId: data.productId, count: reservationsToRelease.length },
          'Inventory released successfully'
        );
      });
    } catch (error) {
      logger.error({ error, orderId: data.orderId }, 'Failed to release inventory');
      throw error;
    }
  }

  async get(productId: string, warehouseId?: string): Promise<Inventory | Inventory[]> {
    try {
      if (warehouseId) {
        // Get inventory for specific warehouse
        const inventoryRecord = await db.query.inventory.findFirst({
          where: and(
            eq(inventory.productId, productId),
            eq(inventory.warehouseId, warehouseId)
          ),
        });

        if (!inventoryRecord) {
          throw new NotFoundError('Inventory', `${productId}:${warehouseId}`);
        }

        return inventoryRecord;
      } else {
        // Get inventory for all warehouses
        const inventoryRecords = await db.query.inventory.findMany({
          where: eq(inventory.productId, productId),
        });

        return inventoryRecords;
      }
    } catch (error) {
      logger.error({ error, productId, warehouseId }, 'Failed to get inventory');
      throw error;
    }
  }

  async batchUpdate(updates: BatchUpdateData[]): Promise<number> {
    try {
      if (updates.length === 0 || updates.length > 1000) {
        throw new ValidationError('Batch size must be between 1 and 1000');
      }

      logger.info({ count: updates.length }, 'Batch updating inventory');

      let updatedCount = 0;

      await db.transaction(async (tx) => {
        for (const update of updates) {
          // Check if inventory record exists
          const existing = await tx.query.inventory.findFirst({
            where: and(
              eq(inventory.productId, update.productId),
              eq(inventory.warehouseId, update.warehouseId)
            ),
          });

          if (existing) {
            // Update existing inventory
            await tx
              .update(inventory)
              .set({
                quantity: update.quantity,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(inventory.productId, update.productId),
                  eq(inventory.warehouseId, update.warehouseId)
                )
              );
            updatedCount++;
          } else {
            // Create new inventory record
            await tx.insert(inventory).values({
              productId: update.productId,
              warehouseId: update.warehouseId,
              quantity: update.quantity,
            });
            updatedCount++;
          }
        }
      });

      logger.info({ count: updatedCount }, 'Batch updated inventory successfully');
      return updatedCount;
    } catch (error) {
      logger.error({ error, count: updates.length }, 'Failed to batch update inventory');
      throw error;
    }
  }
}
