import { FastifyInstance } from 'fastify';
import { InventoryService } from '../services/inventory.service';
import {
  getInventorySchema,
  updateInventorySchema,
  reserveInventorySchema,
  releaseInventorySchema,
  batchUpdateInventorySchema,
  validateRequest,
} from '../schemas/product.schema';
import { logger, AppError } from '@oms/toolkit';

export async function inventoryRoutes(
  fastify: FastifyInstance,
  inventoryService: InventoryService
) {
  // Get inventory
  fastify.get(
    '/api/v1/inventory/:productId',
    { preHandler: validateRequest(getInventorySchema) },
    async (request, reply) => {
      try {
        const { productId } = request.params as any;
        const { warehouseId } = request.query as any;

        const inventory = await inventoryService.get(productId, warehouseId);
        reply.send(inventory);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to get inventory');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get inventory',
            },
          });
        }
      }
    }
  );

  // Update inventory
  fastify.put(
    '/api/v1/inventory/:productId',
    { preHandler: validateRequest(updateInventorySchema) },
    async (request, reply) => {
      try {
        const { productId } = request.params as any;
        const { warehouseId, quantity } = request.body as any;

        const inventory = await inventoryService.update(productId, warehouseId, quantity);
        reply.send(inventory);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to update inventory');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to update inventory',
            },
          });
        }
      }
    }
  );

  // Reserve inventory
  fastify.post(
    '/api/v1/inventory/reserve',
    { preHandler: validateRequest(reserveInventorySchema) },
    async (request, reply) => {
      try {
        const { productId, warehouseId, quantity, orderId } = request.body as any;

        await inventoryService.reserve({
          productId,
          warehouseId,
          quantity,
          orderId,
        });

        reply.code(200).send({
          message: 'Inventory reservation processed',
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
          logger.error({ error }, 'Failed to reserve inventory');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to reserve inventory',
            },
          });
        }
      }
    }
  );

  // Release inventory
  fastify.post(
    '/api/v1/inventory/release',
    { preHandler: validateRequest(releaseInventorySchema) },
    async (request, reply) => {
      try {
        const { productId, warehouseId, quantity, orderId } = request.body as any;

        await inventoryService.release({
          productId,
          warehouseId,
          quantity,
          orderId,
        });

        reply.code(200).send({
          message: 'Inventory released successfully',
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
          logger.error({ error }, 'Failed to release inventory');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to release inventory',
            },
          });
        }
      }
    }
  );

  // Batch update inventory
  fastify.patch(
    '/api/v1/inventory/batch',
    { preHandler: validateRequest(batchUpdateInventorySchema) },
    async (request, reply) => {
      try {
        const { updates } = request.body as any;

        const count = await inventoryService.batchUpdate(updates);

        reply.send({
          message: `Successfully updated ${count} inventory records`,
          count,
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
          logger.error({ error }, 'Failed to batch update inventory');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to batch update inventory',
            },
          });
        }
      }
    }
  );
}
