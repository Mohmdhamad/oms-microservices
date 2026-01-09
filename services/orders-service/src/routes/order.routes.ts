import { FastifyInstance } from 'fastify';
import { OrderService } from '../services/order.service';
import {
  createOrderSchema,
  updateOrderSchema,
  getOrderSchema,
  listOrdersSchema,
  cancelOrderSchema,
  confirmOrderSchema,
  getUserOrdersSchema,
  validateRequest,
} from '../schemas/order.schema';
import { logger, AppError } from '@oms/toolkit';

export async function orderRoutes(
  fastify: FastifyInstance,
  orderService: OrderService
) {
  // Create order
  fastify.post(
    '/api/v1/orders',
    { preHandler: validateRequest(createOrderSchema) },
    async (request, reply) => {
      try {
        const { body } = request as any;
        const order = await orderService.create(body);
        reply.code(201).send(order);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to create order');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create order',
            },
          });
        }
      }
    }
  );

  // List orders
  fastify.get(
    '/api/v1/orders',
    { preHandler: validateRequest(listOrdersSchema) },
    async (request, reply) => {
      try {
        const { query } = request as any;
        const { page, limit, userId, status, fromDate, toDate } = query;

        const filters = {
          userId,
          status,
          fromDate,
          toDate,
        };

        const result = await orderService.list(filters, { page, limit });

        const totalPages = Math.ceil(result.total / limit);

        reply.send({
          orders: result.orders,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        });
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to list orders');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to list orders',
            },
          });
        }
      }
    }
  );

  // Get order by ID
  fastify.get(
    '/api/v1/orders/:id',
    { preHandler: validateRequest(getOrderSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const order = await orderService.findById(id);
        reply.send(order);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to get order');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get order',
            },
          });
        }
      }
    }
  );

  // Update order
  fastify.patch(
    '/api/v1/orders/:id',
    { preHandler: validateRequest(updateOrderSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const { body } = request;
        const order = await orderService.update(id, body as any);
        reply.send(order);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to update order');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to update order',
            },
          });
        }
      }
    }
  );

  // Cancel order
  fastify.post(
    '/api/v1/orders/:id/cancel',
    { preHandler: validateRequest(cancelOrderSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const { reason } = request.body as any;

        await orderService.cancelOrder(id, reason, false);

        reply.send({
          message: 'Order cancelled successfully',
        });
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to cancel order');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to cancel order',
            },
          });
        }
      }
    }
  );

  // Confirm order (manual confirmation)
  fastify.post(
    '/api/v1/orders/:id/confirm',
    { preHandler: validateRequest(confirmOrderSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;

        await orderService.confirmOrder(id);

        reply.send({
          message: 'Order confirmed successfully',
        });
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to confirm order');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to confirm order',
            },
          });
        }
      }
    }
  );

  // Get user orders
  fastify.get(
    '/api/v1/users/:userId/orders',
    { preHandler: validateRequest(getUserOrdersSchema) },
    async (request, reply) => {
      try {
        const { userId } = request.params as any;
        const { page, limit, status } = request.query as any;

        const result = await orderService.getUserOrders(userId, { page, limit }, status);

        const totalPages = Math.ceil(result.total / limit);

        reply.send({
          orders: result.orders,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        });
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to get user orders');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get user orders',
            },
          });
        }
      }
    }
  );
}
