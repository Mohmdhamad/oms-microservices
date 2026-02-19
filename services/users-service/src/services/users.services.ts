  import { User, users } from '../database/schema';
  import { UserDto } from '../routes/UserDto';
  const bcrypt = require('bcrypt');
  import { db } from '../database/client';
  import { UserEventPublisher } from '../events/publisher';
  import { logger, ValidationError } from '@oms/toolkit';
  import { eq } from 'drizzle-orm';
  import { createUserCreatedEvent } from '../events/user-created.event';

  export interface CreateUserData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }
  export class UsersServices {
    constructor(private eventPublisher: UserEventPublisher) {}
    async createUser(data: CreateUserData): Promise<User> {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, data.email),
      });

      if (existingUser) {
        throw new ValidationError('Email already exists');
      }

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
    async updateUser(id: string, data: Partial<CreateUserData>): Promise<User> {
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
    async deleteUser(id: any){
      try {
        const userIdToDelete = typeof id === 'object' && id.id ? id.id : id;
        logger.info({ userId: userIdToDelete }, 'Deleting User');
        const [deletedUser] = await db.delete(users).where(eq(users.id, userIdToDelete)).returning();
        logger.info({ userID: userIdToDelete }, 'User deleted successfully');
        return deletedUser;
      } catch (error) {
        logger.error({ error,}, 'Failed to delete user');
        throw error;
      }
    }
  }
