/**
 * Products Service - Event Consumer
 * Consumes order.created from Orders Service
 * Does NOT import from orders-service!
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { InventoryService } from '../../services/inventory.service';
import { db } from '../../database/client';
import { warehouses } from '../../database/schema';
import { eq } from 'drizzle-orm';

// Products service defines what IT expects from order.created
// Only fields THIS service needs
interface ExpectedOrderPayload {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
    warehouseId?: string;
  }>;
  warehouseId?: string; // Optional: order-level default warehouse
}

export class OrderCreatedConsumer {
  private inventoryService: InventoryService;
  private defaultWarehouseId: string | null = null;

  constructor(inventoryService: InventoryService) {
    this.inventoryService = inventoryService;
  }

  private async getDefaultWarehouseId(): Promise<string> {
    if (this.defaultWarehouseId) {
      return this.defaultWarehouseId;
    }

    // Get first active warehouse as default
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
      const payload = event.data as ExpectedOrderPayload;

      logger.info({ orderId: payload.orderId }, 'Processing order.created event');

      const defaultWarehouseId = await this.getDefaultWarehouseId();

      // Reserve inventory for each item
      for (const item of payload.items) {
        // Use item-level warehouseId, then order-level, then default
        const warehouseId = item.warehouseId || payload.warehouseId || defaultWarehouseId;

        await this.inventoryService.reserve({
          productId: item.productId,
          quantity: item.quantity,
          orderId: payload.orderId,
          warehouseId,
        });
      }

      logger.info({ orderId: payload.orderId }, 'Inventory reservation processed');
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle order.created event');
      throw error;
    }
  }
}
