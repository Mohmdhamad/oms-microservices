/**
 * Orders Service - Event Consumer
 * Consumes inventory.reserved from Products Service
 * Does NOT import from products-service!
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { OrderService } from '../../services/order.service';

// Orders service defines what IT expects from inventory.reserved
interface ExpectedInventoryReservedPayload {
  orderId: string;
  productId: string;
  quantity: number;
  reservedAt: string;
}

export class InventoryReservedConsumer {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  async handle(event: BaseEvent): Promise<void> {
    try {
      const payload = event.data as ExpectedInventoryReservedPayload;

      logger.info({ orderId: payload.orderId }, 'Processing inventory.reserved event');

      // Update order status or track reservation
      await this.orderService.markInventoryReserved(
        payload.orderId,
        payload.productId
      );

      // If all items reserved, move to confirmed status
      const allReserved = await this.orderService.checkAllInventoryReserved(payload.orderId);
      if (allReserved) {
        await this.orderService.confirmOrder(payload.orderId);
        logger.info({ orderId: payload.orderId }, 'Order confirmed - all inventory reserved');
      }
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle inventory.reserved event');
      throw error;
    }
  }
}
