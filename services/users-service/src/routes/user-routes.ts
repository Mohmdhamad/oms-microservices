import { FastifyInstance } from 'fastify';
import { UserDto } from './UserDto';
import { users } from '../database/schema';
import { db } from '../database/client';
import { UsersServices } from '../services/users.services';
import { AppError, logger } from '@oms/toolkit';
import { updateUserSchema, validateRequest } from '../schemas/user.schema';
const bcrypt = require('bcrypt');

/**
 * TASKS
 * 1- use service instead of hardcode the login in the controller
 * 2- Add all other endpoints for user crud operations update user , delete user , list users paginated
 * @param fastify
 * @param usersServices
 */
export function defineUserRoutes(fastify: FastifyInstance, usersServices: UsersServices) {
  // Mohamed endpoint for learning
  mohamedEndpoint(fastify);
  createNewUser(fastify, usersServices);
  updateUser(fastify, usersServices);
  deleteUser(fastify, usersServices);
  // createNewUserRoute(fastify, usersServices);
}
function createNewUserRoute(fastify: FastifyInstance, usersServices: UsersServices) {
  fastify.post('/users/new', async (req, res) => {
    const userDto = req.body as UserDto;
    if (!userDto.password) {
      throw new Error('Password is required');
    }
    const passwordHash = bcrypt.hashSync(userDto.password, 12);

    const savedUser = await db
      .insert(users)
      .values({
        firstName: userDto.firstName,
        lastName: userDto.lastName,
        email: userDto.email,
        passwordHash: passwordHash,
      })
      .returning();

    res.send(savedUser);
  });
}

function mohamedEndpoint(fastify: FastifyInstance) {
  fastify.get('/mohamed-test', (req, res) => {
    res.send({
      status: 'completed',
      message: 'Process completed successfully',
    });
  });
}
function createNewUser(fastify: FastifyInstance, usersServices: UsersServices) {
  fastify.post('/api/v1/user/new', {}, async (request, reply) => {
    try {
      const { body } = request as any;
      const user = await usersServices.createUser(body);
      reply.code(201).send(user);
    } catch (error: any) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error({ error }, 'Failed to Register New User');
        reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to Register New User',
          },
        });
      }
    }
  });
}

function updateUser(fastify: FastifyInstance, usersServices: UsersServices) {
  fastify.patch(
    '/api/v1/user/:id',
    { preHandler: validateRequest(updateUserSchema) },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { body } = request;
        const user = await usersServices.updateUser(id, body as any);
        reply.send(user);
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
}
function deleteUser(fastify: FastifyInstance, usersServices: UsersServices) {
  fastify.delete(
    '/api/v1/user/:id',
    // {preHandler: validateRequest(updateUserSchema)  },
    async (request, reply) => {
      try {
        const id = request.params as any;
        const user = await usersServices.deleteUser(id);
        reply.send(user);
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
}
