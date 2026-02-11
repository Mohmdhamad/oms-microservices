import { FastifyInstance } from 'fastify';
import { UserDto } from './UserDto';
import { users } from '../database/schema';
import { db } from '../database/client';
const bcrypt = require('bcrypt');


/**
 * TASKS
 * 1- use service instead of hardcode the login in the controller
 * 2- Add all other endpoints for user crud operations update user , delete user , list users paginated
 * @param fastify
 */
export function defineUserRoutes(fastify: FastifyInstance) {
  // Mohamed endpoint for learning
  mohamedEndpoint(fastify);

  createNewUserRoute(fastify);
}
 function createNewUserRoute(fastify: FastifyInstance) {
  fastify.post('/users/new', async (req, res) => {
    const userDto = req.body as UserDto;
    if(!userDto.password) {
      throw new Error('Password is required');
    }
    const passwordHash = bcrypt.hashSync(userDto.password, 12);

    const savedUser = await db.insert(users).values({
      firstName: userDto.firstName,
      lastName: userDto.lastName,
      email: userDto.email,
      passwordHash: passwordHash,
    }).returning();

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
