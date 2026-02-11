import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { logger, AppError } from '@oms/toolkit';
import { testConnection, closeConnection } from './database/client';
import { ProductService } from './services/product.service';
import { InventoryService } from './services/inventory.service';
import { WarehouseService } from './services/warehouse.service';
import { productRoutes } from './routes/product.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { warehouseRoutes } from './routes/warehouse.routes';
import { ProductEventPublisher } from './events/publisher';
import { OrderCreatedConsumer } from './events/consumers/order-created.consumer';
import { OrderCancelledConsumer } from './events/consumers/order-cancelled.consumer';
import { RabbitMQClient } from '@oms/toolkit';

const PORT = parseInt(process.env.PORT || '3000', 10);
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

    // Initialize event publisher
    const eventPublisher = new ProductEventPublisher(rabbitMQUrl);
    await eventPublisher.init();

    // Initialize services
    const productService = new ProductService(eventPublisher);
    const inventoryService = new InventoryService(eventPublisher);
    const warehouseService = new WarehouseService();

    // Initialize event consumers
    const orderCreatedConsumer = new OrderCreatedConsumer(inventoryService);
    const orderCancelledConsumer = new OrderCancelledConsumer(inventoryService);

    // Setup RabbitMQ queues and start consuming
    logger.info('Setting up event consumers...');
    const channel = rabbitMQClient.getChannel();

    // Declare exchanges
    await channel.assertExchange('orders', 'topic', { durable: true });

    // Declare queue for this service
    const queueName = 'products-service.orders';
    await channel.assertQueue(queueName, { durable: true });

    // Bind queue to exchange with routing keys
    await channel.bindQueue(queueName, 'orders', 'order.created');
    await channel.bindQueue(queueName, 'orders', 'order.cancelled');

    // Start consuming messages
    channel.consume(
      queueName,
      async (msg) => {
        if (msg) {
          try {
            const event = JSON.parse(msg.content.toString());
            logger.info({ eventType: event.eventType, eventId: event.eventId }, 'Received event');

            if (event.eventType === 'order.created') {
              await orderCreatedConsumer.handle(event);
            } else if (event.eventType === 'order.cancelled') {
              await orderCancelledConsumer.handle(event);
            }

            channel.ack(msg);
          } catch (error) {
            logger.error({ error }, 'Failed to process event');
            // Reject and requeue the message
            channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    logger.info('Event consumers ready');

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

    // Register routes
    await productRoutes(fastify, productService);
    await inventoryRoutes(fastify, inventoryService);
    await warehouseRoutes(fastify, warehouseService);

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      reply.send({
        status: 'healthy',
        service: 'products-service',
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
    logger.info({ port: PORT, host: HOST }, 'Products service started');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');
      try {
        await fastify.close();
        await eventPublisher.close();
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
    logger.error({ error }, 'Failed to start products service');
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
