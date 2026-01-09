import { db } from '../database/client';
import { products, type Product, type NewProduct } from '../database/schema';
import { eq, and, or, ilike, gte, lte, desc, sql } from 'drizzle-orm';
import { logger, NotFoundError, ValidationError } from '@oms/toolkit';
import { ProductEventPublisher } from '../events/publisher';
import { createProductCreatedEvent } from '../events/product-created.event';
import { createProductUpdatedEvent } from '../events/product-updated.event';
import { batchInsert } from '@oms/toolkit/database/batch';

interface ListProductsFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
}

interface PaginationParams {
  page: number;
  limit: number;
}

export class ProductService {
  constructor(private eventPublisher: ProductEventPublisher) {}

  async create(data: NewProduct): Promise<Product> {
    try {
      logger.info({ sku: data.sku }, 'Creating product');

      const [product] = await db.insert(products).values(data).returning();

      // Publish product.created event
      const event = createProductCreatedEvent({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: parseFloat(product.price),
        categoryId: product.categoryId || undefined,
        createdAt: product.createdAt.toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'product.created');

      logger.info({ productId: product.id }, 'Product created successfully');
      return product;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ValidationError(`Product with SKU ${data.sku} already exists`);
      }
      logger.error({ error, sku: data.sku }, 'Failed to create product');
      throw error;
    }
  }

  async update(id: string, data: Partial<NewProduct>): Promise<Product> {
    try {
      logger.info({ productId: id }, 'Updating product');

      const updatedData = {
        ...data,
        updatedAt: new Date(),
      };

      const [product] = await db
        .update(products)
        .set(updatedData)
        .where(eq(products.id, id))
        .returning();

      if (!product) {
        throw new NotFoundError('Product', id);
      }

      // Publish product.updated event
      const event = createProductUpdatedEvent({
        productId: product.id,
        changes: data,
        updatedAt: product.updatedAt.toISOString(),
      });

      await this.eventPublisher.publishEvent(event, 'product.updated');

      logger.info({ productId: id }, 'Product updated successfully');
      return product;
    } catch (error) {
      logger.error({ error, productId: id }, 'Failed to update product');
      throw error;
    }
  }

  async findById(id: string): Promise<Product> {
    try {
      const product = await db.query.products.findFirst({
        where: eq(products.id, id),
      });

      if (!product) {
        throw new NotFoundError('Product', id);
      }

      return product;
    } catch (error) {
      logger.error({ error, productId: id }, 'Failed to find product');
      throw error;
    }
  }

  async list(
    filters: ListProductsFilters,
    pagination: PaginationParams
  ): Promise<{ products: Product[]; total: number }> {
    try {
      const conditions = [];

      if (filters.search) {
        conditions.push(
          or(
            ilike(products.name, `%${filters.search}%`),
            ilike(products.description, `%${filters.search}%`),
            ilike(products.sku, `%${filters.search}%`)
          )
        );
      }

      if (filters.categoryId) {
        conditions.push(eq(products.categoryId, filters.categoryId));
      }

      if (filters.minPrice !== undefined) {
        conditions.push(gte(products.price, filters.minPrice.toString()));
      }

      if (filters.maxPrice !== undefined) {
        conditions.push(lte(products.price, filters.maxPrice.toString()));
      }

      if (filters.isActive !== undefined) {
        conditions.push(eq(products.isActive, filters.isActive));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(whereClause);

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const productsList = await db.query.products.findMany({
        where: whereClause,
        orderBy: [desc(products.createdAt)],
        limit: pagination.limit,
        offset,
      });

      logger.info({ count, filters, pagination }, 'Listed products');
      return { products: productsList, total: count };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to list products');
      throw error;
    }
  }

  async batchCreate(productsData: NewProduct[]): Promise<number> {
    try {
      if (productsData.length === 0 || productsData.length > 1000) {
        throw new ValidationError('Batch size must be between 1 and 1000');
      }

      logger.info({ count: productsData.length }, 'Batch creating products');

      const insertedProducts = await db.insert(products).values(productsData).returning();

      // Publish events for each created product
      for (const product of insertedProducts) {
        const event = createProductCreatedEvent({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          price: parseFloat(product.price),
          categoryId: product.categoryId || undefined,
          createdAt: product.createdAt.toISOString(),
        });

        await this.eventPublisher.publishEvent(event, 'product.created');
      }

      logger.info({ count: insertedProducts.length }, 'Batch created products successfully');
      return insertedProducts.length;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ValidationError('One or more products have duplicate SKUs');
      }
      logger.error({ error, count: productsData.length }, 'Failed to batch create products');
      throw error;
    }
  }

  async delete(id: string): Promise<Product> {
    try {
      logger.info({ productId: id }, 'Soft deleting product');

      const [product] = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (!product) {
        throw new NotFoundError('Product', id);
      }

      logger.info({ productId: id }, 'Product soft deleted successfully');
      return product;
    } catch (error) {
      logger.error({ error, productId: id }, 'Failed to delete product');
      throw error;
    }
  }
}
