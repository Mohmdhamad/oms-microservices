/**
 * Orders Service - Event Consumer
 * Consumes payment.failed from Payments Service
 * Cancels order when payment fails
 */
import { BaseEvent, logger } from '@oms/toolkit';
import { OrderService } from '../../services/order.service';

interface ExpectedPaymentFailedPayload {
  paymentId: string;
  orderId: string;
  amount: number;
  error: string;
  failedAt: string;
}

export class PaymentFailedConsumer {
  private orderService: OrderService;

  constructor(orderService: OrderService) {
    this.orderService = orderService;
  }

  async handle(event: BaseEvent): Promise<void> {
    try {
      const payload = event.data as ExpectedPaymentFailedPayload;

      logger.warn({ orderId: payload.orderId }, 'Processing payment.failed event');

      // Cancel the order
      await this.orderService.cancelOrder(
        payload.orderId,
        `Payment failed: ${payload.error}`,
        true // automated
      );

      logger.info({ orderId: payload.orderId }, 'Order cancelled due to payment failure');
    } catch (error) {
      logger.error({ error, eventId: event.eventId }, 'Failed to handle payment.failed event');
      throw error;
    }
  }
}
