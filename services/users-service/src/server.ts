import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { logger } from '@oms/toolkit';
import { RabbitMQClient } from '@oms/toolkit';
import { defineUserRoutes } from "./routes/user-routes";
import { UsersServices } from './services/users.services';
import { UserEventPublisher } from './events/publisher';
import errorHandler from '@oms/toolkit/src/errors/error_handler';

const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    // Initialize RabbitMQ
    logger.info('Connecting to RabbitMQ...');
    const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:rabbitmq@localhost:5672';
    const rabbitMQClient = RabbitMQClient.getInstance(rabbitMQUrl);
    await rabbitMQClient.connect();

    // Initialize Services
    const userEventPublisher = new UserEventPublisher(rabbitMQUrl);
    const usersServices = new UsersServices(userEventPublisher);

    // Create Fastify app
    const fastify = Fastify({
      logger: false, // Use our custom logger
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
    });

    // Register plugins
    await fastify.register(errorHandler);

    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });


    await fastify.register(helmet, {
      contentSecurityPolicy: false,
    });

    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return reply.send({
        status: 'healthy',
        service: 'users-service',
        timestamp: new Date().toISOString(),
      });
    });

    // Define all user routes
    defineUserRoutes(fastify, usersServices);

    // Start server
    await fastify.listen({ port: PORT, host: HOST });
    logger.info({ port: PORT, host: HOST }, 'Users service started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      try {
        await fastify.close();
        await rabbitMQClient.close();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start users service');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

start();
