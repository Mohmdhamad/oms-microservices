import { db } from '../database/client';
import { warehouses, type Warehouse, type NewWarehouse } from '../database/schema';
import { eq } from 'drizzle-orm';
import { logger, NotFoundError } from '@oms/toolkit';

export class WarehouseService {
  async create(data: NewWarehouse): Promise<Warehouse> {
    try {
      logger.info({ name: data.name }, 'Creating warehouse');

      const [warehouse] = await db.insert(warehouses).values(data).returning();

      logger.info({ warehouseId: warehouse.id }, 'Warehouse created successfully');
      return warehouse;
    } catch (error) {
      logger.error({ error, name: data.name }, 'Failed to create warehouse');
      throw error;
    }
  }

  async list(): Promise<Warehouse[]> {
    try {
      const warehousesList = await db.query.warehouses.findMany({
        where: eq(warehouses.isActive, true),
      });

      logger.info({ count: warehousesList.length }, 'Listed warehouses');
      return warehousesList;
    } catch (error) {
      logger.error({ error }, 'Failed to list warehouses');
      throw error;
    }
  }

  async findById(id: string): Promise<Warehouse> {
    try {
      const warehouse = await db.query.warehouses.findFirst({
        where: eq(warehouses.id, id),
      });

      if (!warehouse) {
        throw new NotFoundError('Warehouse', id);
      }

      return warehouse;
    } catch (error) {
      logger.error({ error, warehouseId: id }, 'Failed to find warehouse');
      throw error;
    }
  }
}
