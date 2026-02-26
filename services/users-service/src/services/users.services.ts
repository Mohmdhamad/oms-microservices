  import { User, users } from '../database/schema';
  const bcrypt = require('bcrypt');
  import { db } from '../database/client';
  import { UserEventPublisher } from '../events/publisher';
  import { logger, PaginationParams, ValidationError } from '@oms/toolkit';
  import { eq, like, or, sql } from 'drizzle-orm';
  import { ListUserRequest, UserForm } from './types';

  export class UsersServices {
    constructor(private eventPublisher: UserEventPublisher) {}
    // Register new user
    async createUser(data: UserForm): Promise<User> {

      const passwordHash = await bcrypt.hash(data.password, 12);

      const [savedUser] = await db
        .insert(users)
        .values({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash,
        })
        .returning();


      return savedUser;
    }
    // Update user
    async updateUser(id: string, data: Partial<UserForm>): Promise<User> {
      try {
        logger.info({ userId: id }, 'Updating User');
        const updatedData : any = {
          ...data,
          updatedAt: new Date(),
        };
        const [updatedUser] = await db.update(users).set(updatedData).where(eq(users.id, id)).returning();
        if (!updatedUser) {
          throw new ValidationError('User not found',id);
        }
        logger.info({ userID: id }, 'User updated successfully');
        return updatedUser;
      } catch (error) {
        logger.error({ error,}, 'Failed to update user');
        throw error;
      }
    }
    // delete user
    async deleteUser(id: any){
      try {
        const userIdToDelete = typeof id === 'object' && id.id ? id.id : id;
        logger.info({ userId: userIdToDelete }, 'Deleting User');
        await db.delete(users).where(eq(users.id, userIdToDelete)).execute();
        logger.info({ userID: userIdToDelete }, 'User deleted successfully');
      } catch (error) {
        logger.error({ error,}, 'Failed to delete user');
        throw error;
      }
    }
    // List Users
    async listUsers(requestForm: ListUserRequest): Promise<{users: any[], total: number}> {
      try {
        const condition = requestForm.searchTerm ? or(like(users.firstName, requestForm.searchTerm), like(users.email, requestForm.searchTerm)) : eq(1, 1);
        const offset = (requestForm.page - 1) * requestForm.limit;

        const [resultList, countResult] = await Promise.all([
          db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            })
            .from(users)
            .where(condition)
            .limit(requestForm.limit)
            .offset(offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(condition),
        ]);

        const total = Number(countResult[0]?.count ?? 0);
        return {users: resultList, total}

      } catch (error) {
        logger.error({ error }, 'Failed to list users');
        throw error;
      }
    }
  }
