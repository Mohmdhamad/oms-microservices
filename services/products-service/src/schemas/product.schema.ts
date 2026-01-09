/**
 * Products Service - OWN validation schemas
 * No dependency on other services' schemas
 */
import { z } from 'zod';

// Common validations for THIS service
const uuidSchema = z.string().uuid();
const positiveNumberSchema = z.number().positive();
const nonNegativeNumberSchema = z.number().nonnegative();

// Create product
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Product name is required').max(255),
    description: z.string().min(1, 'Description is required'),
    sku: z.string().min(1, 'SKU is required').max(100),
    price: positiveNumberSchema,
    categoryId: uuidSchema.optional(),
    attributes: z.record(z.any()).optional(),
    imageUrl: z.string().url().optional(),
  }),
});

// Update product
export const updateProductSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    price: positiveNumberSchema.optional(),
    categoryId: uuidSchema.optional(),
    attributes: z.record(z.any()).optional(),
    imageUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  }),
});

// Get product
export const getProductSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// List products
export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    categoryId: uuidSchema.optional(),
    minPrice: nonNegativeNumberSchema.optional(),
    maxPrice: nonNegativeNumberSchema.optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

// Get inventory
export const getInventorySchema = z.object({
  params: z.object({
    productId: uuidSchema,
  }),
  query: z.object({
    warehouseId: uuidSchema.optional(),
  }),
});

// Update inventory
export const updateInventorySchema = z.object({
  params: z.object({
    productId: uuidSchema,
  }),
  body: z.object({
    warehouseId: uuidSchema,
    quantity: nonNegativeNumberSchema,
  }),
});

// Reserve inventory
export const reserveInventorySchema = z.object({
  body: z.object({
    productId: uuidSchema,
    warehouseId: uuidSchema,
    quantity: positiveNumberSchema,
    orderId: uuidSchema,
  }),
});

// Release inventory
export const releaseInventorySchema = z.object({
  body: z.object({
    productId: uuidSchema,
    warehouseId: uuidSchema,
    quantity: positiveNumberSchema,
    orderId: uuidSchema,
  }),
});

// Batch create products
export const batchCreateProductsSchema = z.object({
  body: z.object({
    products: z.array(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().min(1),
        sku: z.string().min(1).max(100),
        price: positiveNumberSchema,
        categoryId: uuidSchema.optional(),
        attributes: z.record(z.any()).optional(),
      })
    ).min(1, 'At least one product is required').max(1000, 'Maximum 1000 products per batch'),
  }),
});

// Batch update inventory
export const batchUpdateInventorySchema = z.object({
  body: z.object({
    updates: z.array(
      z.object({
        productId: uuidSchema,
        warehouseId: uuidSchema,
        quantity: nonNegativeNumberSchema,
      })
    ).min(1, 'At least one update is required').max(1000, 'Maximum 1000 updates per batch'),
  }),
});

// Create warehouse
export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Warehouse name is required').max(255),
    location: z.string().min(1, 'Location is required').max(500),
    isActive: z.boolean().optional().default(true),
  }),
});

// Get warehouse
export const getWarehouseSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Validation middleware
export function validateRequest(schema: z.ZodSchema) {
  return async (request: any, reply: any) => {
    try {
      const toValidate: any = {};
      if (schema.shape?.body) toValidate.body = request.body;
      if (schema.shape?.query) toValidate.query = request.query;
      if (schema.shape?.params) toValidate.params = request.params;

      await schema.parseAsync(toValidate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      } else {
        throw error;
      }
    }
  };
}
