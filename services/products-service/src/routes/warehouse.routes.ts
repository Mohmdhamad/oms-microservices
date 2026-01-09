import { FastifyInstance } from 'fastify';
import { WarehouseService } from '../services/warehouse.service';
import {
  createWarehouseSchema,
  getWarehouseSchema,
  validateRequest,
} from '../schemas/product.schema';
import { logger, AppError } from '@oms/toolkit';

export async function warehouseRoutes(
  fastify: FastifyInstance,
  warehouseService: WarehouseService
) {
  // Create warehouse
  fastify.post(
    '/api/v1/warehouses',
    { preHandler: validateRequest(createWarehouseSchema) },
    async (request, reply) => {
      try {
        const { body } = request;
        const warehouse = await warehouseService.create(body as any);
        reply.code(201).send(warehouse);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to create warehouse');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create warehouse',
            },
          });
        }
      }
    }
  );

  // List warehouses
  fastify.get('/api/v1/warehouses', async (request, reply) => {
    try {
      const warehouses = await warehouseService.list();
      reply.send(warehouses);
    } catch (error: any) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error({ error }, 'Failed to list warehouses');
        reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list warehouses',
          },
        });
      }
    }
  });

  // Get warehouse by ID
  fastify.get(
    '/api/v1/warehouses/:id',
    { preHandler: validateRequest(getWarehouseSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const warehouse = await warehouseService.findById(id);
        reply.send(warehouse);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to get warehouse');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get warehouse',
            },
          });
        }
      }
    }
  );
}
