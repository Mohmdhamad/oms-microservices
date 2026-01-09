import { db } from '../database/client';
import {
  orders,
  orderItems,
  orderInventoryTracking,
  type Order,
  type NewOrder,
  type OrderItem,
  type NewOrderItem,
} from '../database/schema';
import { eq, and, or, gte, lte, desc, sql } from 'drizzle-orm';
import { logger, NotFoundError, ValidationError } from '@oms/toolkit';
import { OrderEventPublisher } from '../events/publisher';
import { createOrderCreatedEvent } from '../events/order-created.event';
import { createOrderConfirmedEvent } from '../events/order-confirmed.event';
import { createOrderCancelledEvent } from '../events/order-cancelled.event';
import { createOrderShippedEvent } from '../events/order-shipped.event';

interface CreateOrderData {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    productSnapshot?: Record<string, any>;
  }>;
  shippingAddress: Record<string, any>;
  billingAddress?: Record<string, any>;
  notes?: string;
}

interface ListOrdersFilters {
  userId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

interface PaginationParams {
  page: number;
  limit: number;
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export class OrderService {
  constructor(private eventPublisher: OrderEventPublisher) {}

  async create(data: CreateOrderData): Promise<Order & { items: OrderItem[] }> {
    try {
      logger.info({ userId: data.userId }, 'Creating order');

      // Calculate total amount
      const totalAmount = data.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );

      const result = await db.transaction(async (tx) => {
        // Create order
        const [order] = await tx
          .insert(orders)
          .values({
            userId: data.userId,
            totalAmount: totalAmount.toFixed(2),
            shippingAddress: data.shippingAddress,
            billingAddress: data.billingAddress,
            notes: data.notes,
            status: 'pending',
          })
          .returning();

        // Create order items
        const orderItemsData: NewOrderItem[] = data.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          productSnapshot: item.productSnapshot,
        }));

        const createdItems = await tx.insert(orderItems).values(orderItemsData).returning();

        // Create inventory tracking records
        const trackingData = data.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          inventoryReserved: false,
        }));

        await tx.insert(orderInventoryTracking).values(trackingData);

        return { order, items: createdItems };
      });

      // Publish order.created event
      const event = createOrderCreatedEvent({
        orderId: result.order.id,
        userId: result.order.userId,
        items: result.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
        })),
        totalAmount: parseFloat(result.order.totalAmount),
        shippingAddress: result.order.shippingAddress as any,
        createdAt: result.order.createdAt.toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'order.created');

      logger.info({ orderId: result.order.id }, 'Order created successfully');
      return { ...result.order, items: result.items };
    } catch (error) {
      logger.error({ error, userId: data.userId }, 'Failed to create order');
      throw error;
    }
  }

  async update(id: string, data: Partial<NewOrder>): Promise<Order> {
    try {
      logger.info({ orderId: id }, 'Updating order');

      const updatedData = {
        ...data,
        updatedAt: new Date(),
      };

      const [order] = await db
        .update(orders)
        .set(updatedData)
        .where(eq(orders.id, id))
        .returning();

      if (!order) {
        throw new NotFoundError('Order', id);
      }

      logger.info({ orderId: id }, 'Order updated successfully');
      return order;
    } catch (error) {
      logger.error({ error, orderId: id }, 'Failed to update order');
      throw error;
    }
  }

  async findById(id: string): Promise<Order & { items: OrderItem[] }> {
    try {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          items: true,
        },
      });

      if (!order) {
        throw new NotFoundError('Order', id);
      }

      return order as Order & { items: OrderItem[] };
    } catch (error) {
      logger.error({ error, orderId: id }, 'Failed to find order');
      throw error;
    }
  }

  async list(
    filters: ListOrdersFilters,
    pagination: PaginationParams
  ): Promise<{ orders: (Order & { items: OrderItem[] })[]; total: number }> {
    try {
      const conditions = [];

      if (filters.userId) {
        conditions.push(eq(orders.userId, filters.userId));
      }

      if (filters.status) {
        conditions.push(eq(orders.status, filters.status as any));
      }

      if (filters.fromDate) {
        conditions.push(gte(orders.createdAt, filters.fromDate));
      }

      if (filters.toDate) {
        conditions.push(lte(orders.createdAt, filters.toDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(whereClause);

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const ordersList = await db.query.orders.findMany({
        where: whereClause,
        with: {
          items: true,
        },
        orderBy: [desc(orders.createdAt)],
        limit: pagination.limit,
        offset,
      });

      logger.info({ count, filters, pagination }, 'Listed orders');
      return { orders: ordersList as (Order & { items: OrderItem[] })[], total: count };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to list orders');
      throw error;
    }
  }

  async getUserOrders(
    userId: string,
    pagination: PaginationParams,
    status?: OrderStatus
  ): Promise<{ orders: (Order & { items: OrderItem[] })[]; total: number }> {
    try {
      const filters: ListOrdersFilters = { userId };
      if (status) {
        filters.status = status;
      }

      return this.list(filters, pagination);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user orders');
      throw error;
    }
  }

  async markInventoryReserved(orderId: string, productId: string): Promise<void> {
    try {
      logger.info({ orderId, productId }, 'Marking inventory as reserved');

      await db
        .update(orderInventoryTracking)
        .set({
          inventoryReserved: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orderInventoryTracking.orderId, orderId),
            eq(orderInventoryTracking.productId, productId)
          )
        );

      logger.info({ orderId, productId }, 'Inventory marked as reserved');
    } catch (error) {
      logger.error({ error, orderId, productId }, 'Failed to mark inventory as reserved');
      throw error;
    }
  }

  async checkAllInventoryReserved(orderId: string): Promise<boolean> {
    try {
      const trackingRecords = await db.query.orderInventoryTracking.findMany({
        where: eq(orderInventoryTracking.orderId, orderId),
      });

      if (trackingRecords.length === 0) {
        return false;
      }

      const allReserved = trackingRecords.every((record) => record.inventoryReserved);

      logger.info(
        { orderId, allReserved, total: trackingRecords.length },
        'Checked inventory reservation status'
      );

      return allReserved;
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to check inventory reservation status');
      throw error;
    }
  }

  async confirmOrder(orderId: string): Promise<void> {
    try {
      logger.info({ orderId }, 'Confirming order');

      const [order] = await db
        .update(orders)
        .set({
          status: 'confirmed',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      // Publish order.confirmed event
      const event = createOrderConfirmedEvent({
        orderId: order.id,
        userId: order.userId,
        totalAmount: parseFloat(order.totalAmount),
        confirmedAt: new Date().toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'order.confirmed');

      logger.info({ orderId }, 'Order confirmed successfully');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to confirm order');
      throw error;
    }
  }

  async cancelOrder(
    orderId: string,
    reason: string,
    automated: boolean = false
  ): Promise<void> {
    try {
      logger.info({ orderId, reason, automated }, 'Cancelling order');

      const order = await this.findById(orderId);

      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          notes: order.notes ? `${order.notes}\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!updatedOrder) {
        throw new NotFoundError('Order', orderId);
      }

      // Publish order.cancelled event
      const event = createOrderCancelledEvent({
        orderId: updatedOrder.id,
        userId: updatedOrder.userId,
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        reason,
        cancelledAt: updatedOrder.cancelledAt!.toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'order.cancelled');

      logger.info({ orderId }, 'Order cancelled successfully');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to cancel order');
      throw error;
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    paymentId?: string,
    transactionId?: string
  ): Promise<void> {
    try {
      logger.info({ orderId, status }, 'Updating order status');

      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (paymentId) {
        updateData.paymentId = paymentId;
      }

      if (transactionId) {
        updateData.transactionId = transactionId;
      }

      const [order] = await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, orderId))
        .returning();

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      logger.info({ orderId, status }, 'Order status updated successfully');
    } catch (error) {
      logger.error({ error, orderId, status }, 'Failed to update order status');
      throw error;
    }
  }

  async shipOrder(
    orderId: string,
    trackingNumber?: string,
    carrier?: string
  ): Promise<void> {
    try {
      logger.info({ orderId, trackingNumber, carrier }, 'Shipping order');

      const [order] = await db
        .update(orders)
        .set({
          status: 'shipped',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!order) {
        throw new NotFoundError('Order', orderId);
      }

      // Publish order.shipped event
      const event = createOrderShippedEvent({
        orderId: order.id,
        userId: order.userId,
        trackingNumber,
        carrier,
        shippedAt: new Date().toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'order.shipped');

      logger.info({ orderId }, 'Order shipped successfully');
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to ship order');
      throw error;
    }
  }
}
