/**
 * Orders Service - Event Consumer
 * Consumes inventory.insufficient from Products Service
 * Cancels order when inventory cannot be reserved
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { OrderService } from '../../services/order.service';

interface ExpectedInventoryInsufficientPayload {
  orderId: string;
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: string;
}

export class InventoryInsufficientConsumer {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  async handle(event: BaseEvent): Promise<void> {
    try {
      const payload = event.data as ExpectedInventoryInsufficientPayload;

      logger.warn({ orderId: payload.orderId }, 'Processing inventory.insufficient event');

      // Cancel the order
      await this.orderService.cancelOrder(
        payload.orderId,
        `Insufficient inventory for product ${payload.productId}. ${payload.reason}`,
        true // automated
      );

      logger.info({ orderId: payload.orderId }, 'Order cancelled due to insufficient inventory');
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle inventory.insufficient event');
      throw error;
    }
  }
}
