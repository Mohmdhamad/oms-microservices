/**
 * Orders Service - Event Consumer
 * Consumes payment.completed from Payments Service
 * Moves order to processing status
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { OrderService } from '../../services/order.service';

interface ExpectedPaymentCompletedPayload {
  paymentId: string;
  orderId: string;
  amount: number;
  transactionId: string;
  completedAt: string;
}

export class PaymentCompletedConsumer {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  async handle(event: BaseEvent): Promise<void> {
    try {
      const payload = event.data as ExpectedPaymentCompletedPayload;

      logger.info({ orderId: payload.orderId }, 'Processing payment.completed event');

      // Update order status to processing
      await this.orderService.updateOrderStatus(
        payload.orderId,
        'processing',
        payload.paymentId,
        payload.transactionId
      );

      logger.info({ orderId: payload.orderId }, 'Order moved to processing status');
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle payment.completed event');
      throw error;
    }
  }
}
