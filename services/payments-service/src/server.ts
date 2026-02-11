import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { logger, AppError } from '@oms/toolkit';
import { RabbitMQClient } from '@oms/toolkit';
import { testConnection, closeConnection } from './database/client';

const PORT = parseInt(process.env.PORT || '3004', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    // Test database connection
    logger.info('Connecting to database...');
    await testConnection();

    // Initialize RabbitMQ
    logger.info('Connecting to RabbitMQ...');
    const rabbitMQUrl = process.env.RABBITMQ_URL || 'amqp://rabbitmq:rabbitmq@localhost:5672';
    const rabbitMQClient = RabbitMQClient.getInstance(rabbitMQUrl);
    await rabbitMQClient.connect();

    // Create Fastify app
    const fastify = Fastify({
      logger: false, // Use our custom logger
      requestIdLogLabel: 'requestId',
      disableRequestLogging: false,
    });

    // Register plugins
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
      reply.send({
        status: 'healthy',
        service: 'payments-service',
        timestamp: new Date().toISOString(),
      });
    });

    // Global error handler
    fastify.setErrorHandler((error, request, reply) => {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      } else {
        logger.error({ error, requestId: request.id }, 'Unhandled error');
        reply.code(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        });
      }
    });

    // Start server
    await fastify.listen({ port: PORT, host: HOST });
    logger.info({ port: PORT, host: HOST }, 'Payments service started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      try {
        await fastify.close();
        await rabbitMQClient.close();
        await closeConnection();
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
    logger.error({ error }, 'Failed to start payments service');
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
