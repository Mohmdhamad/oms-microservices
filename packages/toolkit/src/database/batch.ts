import { QueryResult } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import format from 'pg-format';
import { logger } from '../logger';

export interface BatchInsertOptions {
  batchSize?: number;
  onBatchComplete?: (count: number) => void;
  onError?: (error: Error, batch: any[]) => void;
}

export interface BatchUpdateOptions {
  batchSize?: number;
  onBatchComplete?: (count: number) => void;
  onError?: (error: Error, batch: any[]) => void;
}

/**
 * Batch insert records into database
 * Uses pg-format for safe SQL generation
 */
export async function batchInsert<T extends Record<string, any>>(
    db: NodePgDatabase<any>,
    tableName: string,
    columns: string[],
    records: T[],
    options: BatchInsertOptions = {}
): Promise<number> {
  const {
    batchSize = 1000,
    onBatchComplete,
    onError
  } = options;

  let totalInserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const values = batch.map(record =>
          columns.map(col => record[col])
      );

      const insertQuery = format(
          'INSERT INTO %I (%s) VALUES %L',
          tableName,
          columns.map(col => format('%I', col)).join(', '),
          values
      );

      await db.execute(sql.raw(insertQuery));
      totalInserted += batch.length;

      if (onBatchComplete) {
        onBatchComplete(totalInserted);
      }
    } catch (error) {
      logger.error({ error, batch: batch.length }, 'Batch insert failed');
      if (onError) {
        onError(error as Error, batch);
      } else {
        throw error;
      }
    }
  }

  return totalInserted;
}

/**
 * Batch update records in database
 */
export async function batchUpdate<T extends Record<string, any>>(
    db: NodePgDatabase<any>,
    tableName: string,
    records: T[],
    keyColumn: string,
    updateColumns: string[],
    options: BatchUpdateOptions = {}
): Promise<number> {
  const {
    batchSize = 1000,
    onBatchComplete,
    onError
  } = options;

  let totalUpdated = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      for (const record of batch) {
        if (!record) continue;

        const keys = Object.keys(record);
        if (keys.length === 0) continue;

        const setClauses = updateColumns
            .filter(col => col !== keyColumn && keys.includes(col))
            .map(col => format('%I = %L', col, record[col]))
            .join(', ');

        if (!setClauses) continue;

        const updateQuery = format(
            'UPDATE %I SET %s WHERE %I = %L',
            tableName,
            setClauses,
            keyColumn,
            record[keyColumn]
        );

        await db.execute(sql.raw(updateQuery));
        totalUpdated++;
      }

      if (onBatchComplete) {
        onBatchComplete(totalUpdated);
      }
    } catch (error) {
      logger.error({ error, batch: batch.length }, 'Batch update failed');
      if (onError) {
        onError(error as Error, batch);
      } else {
        throw error;
      }
    }
  }

  return totalUpdated;
}

/**
 * Batch delete records from database
 */
export async function batchDelete(
    db: NodePgDatabase<any>,
    tableName: string,
    keyColumn: string,
    keys: (string | number)[],
    options: BatchUpdateOptions = {}
): Promise<number> {
  const {
    batchSize = 1000,
    onBatchComplete,
    onError
  } = options;

  let totalDeleted = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);

    try {
      const deleteQuery = format(
          'DELETE FROM %I WHERE %I IN (%L)',
          tableName,
          keyColumn,
          batch
      );

      const result: QueryResult = await db.execute(sql.raw(deleteQuery));
      totalDeleted += result.rowCount || 0;

      if (onBatchComplete) {
        onBatchComplete(totalDeleted);
      }
    } catch (error) {
      logger.error({ error, batch: batch.length }, 'Batch delete failed');
      if (onError) {
        onError(error as Error, batch);
      } else {
        throw error;
      }
    }
  }

  return totalDeleted;
}
export class batchUpsert {
}