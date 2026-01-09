/**
 * Products Service - Event Consumer
 * Consumes order.cancelled from Orders Service
 * Releases reserved inventory
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { InventoryService } from '../../services/inventory.service';
import { db } from '../../database/client';
import { warehouses } from '../../database/schema';
import { eq } from 'drizzle-orm';

interface ExpectedOrderCancelledPayload {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
    warehouseId?: string;
  }>;
  warehouseId?: string;
}

export class OrderCancelledConsumer {
  private inventoryService: InventoryService;
  private defaultWarehouseId: string | null = null;

  constructor(inventoryService: InventoryService) {
    this.inventoryService = inventoryService;
  }

  private async getDefaultWarehouseId(): Promise<string> {
    if (this.defaultWarehouseId) {
      return this.defaultWarehouseId;
    }

    const warehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.isActive, true),
    });

    if (!warehouse) {
      throw new Error('No active warehouse found');
    }

    this.defaultWarehouseId = warehouse.id;
    return this.defaultWarehouseId;
  }

  async handle(event: BaseEvent): Promise<void> {
    try {
      const payload = event.data as ExpectedOrderCancelledPayload;

      logger.info({ orderId: payload.orderId }, 'Processing order.cancelled event');

      const defaultWarehouseId = await this.getDefaultWarehouseId();

      // Release reserved inventory for each item
      for (const item of payload.items) {
        const warehouseId = item.warehouseId || payload.warehouseId || defaultWarehouseId;

        await this.inventoryService.release({
          productId: item.productId,
          quantity: item.quantity,
          orderId: payload.orderId,
          warehouseId,
        });
      }

      logger.info({ orderId: payload.orderId }, 'Inventory released successfully');
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle order.cancelled event');
      throw error;
    }
  }
}
