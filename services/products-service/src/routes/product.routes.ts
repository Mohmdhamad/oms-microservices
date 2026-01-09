import { FastifyInstance } from 'fastify';
import { ProductService } from '../services/product.service';
import {
  createProductSchema,
  updateProductSchema,
  getProductSchema,
  listProductsSchema,
  batchCreateProductsSchema,
  validateRequest,
} from '../schemas/product.schema';
import { logger, AppError } from '@oms/toolkit';

export async function productRoutes(
  fastify: FastifyInstance,
  productService: ProductService
) {
  // Create product
  fastify.post(
    '/api/v1/products',
    { preHandler: validateRequest(createProductSchema) },
    async (request, reply) => {
      try {
        const { body } = request;
        const product = await productService.create(body as any);
        reply.code(201).send(product);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to create product');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to create product',
            },
          });
        }
      }
    }
  );

  // List products
  fastify.get(
    '/api/v1/products',
    { preHandler: validateRequest(listProductsSchema) },
    async (request, reply) => {
      try {
        const { query } = request as any;
        const { page, limit, search, categoryId, minPrice, maxPrice, isActive } = query;

        const filters = {
          search,
          categoryId,
          minPrice,
          maxPrice,
          isActive,
        };

        const result = await productService.list(filters, { page, limit });

        const totalPages = Math.ceil(result.total / limit);

        reply.send({
          products: result.products,
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
          logger.error({ error }, 'Failed to list products');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to list products',
            },
          });
        }
      }
    }
  );

  // Get product by ID
  fastify.get(
    '/api/v1/products/:id',
    { preHandler: validateRequest(getProductSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const product = await productService.findById(id);
        reply.send(product);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to get product');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get product',
            },
          });
        }
      }
    }
  );

  // Update product
  fastify.patch(
    '/api/v1/products/:id',
    { preHandler: validateRequest(updateProductSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as any;
        const { body } = request;
        const product = await productService.update(id, body as any);
        reply.send(product);
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to update product');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to update product',
            },
          });
        }
      }
    }
  );

  // Batch create products
  fastify.post(
    '/api/v1/products/batch',
    { preHandler: validateRequest(batchCreateProductsSchema) },
    async (request, reply) => {
      try {
        const { products } = request.body as any;
        const count = await productService.batchCreate(products);
        reply.code(201).send({
          message: `Successfully created ${count} products`,
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
          logger.error({ error }, 'Failed to batch create products');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to batch create products',
            },
          });
        }
      }
    }
  );
}
