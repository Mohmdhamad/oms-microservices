import { FastifyInstance } from 'fastify';
import { users } from '../database/schema';
import { db } from '../database/client';
import { UsersServices } from '../services/users.services';
import { AppError, logger } from '@oms/toolkit';
import { updateUserSchema, validateRequest } from '../schemas/user.schema';
import { userEntityToForm } from '../services/converts';
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
  listUsers(fastify, usersServices);
  // createNewUserRoute(fastify, usersServices);
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
  fastify.post('/api/v1/user', {}, async (request, reply) => {
    try {
      const { body } = request as any;
      const user = await usersServices.createUser(body);
      const userForm = userEntityToForm(user);
      reply.code(201).send(userForm);
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
          logger.error({ error }, 'Failed to update User');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to update User',
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
        await usersServices.deleteUser(id);
        reply.send({ success: true });
      } catch (error: any) {
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
            },
          });
        } else {
          logger.error({ error }, 'Failed to update User');
          reply.code(500).send({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to update User',
            },
          });
        }
      }
    }
  );
}
function listUsers(fastify: FastifyInstance, usersServices: UsersServices) {
  fastify.get('/api/v1/users', async (request, reply) => {
    try {
      const { query } = request as any;
      const { page, limit, searchTerm } = query;
      const users = await usersServices.listUsers({page, limit, searchTerm});
      reply.send(users);
    } catch (error: any) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      } else {
        logger.error({ error }, 'Failed to update User');
        reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update User`',
          },
        });
      }
    }
  });
}
