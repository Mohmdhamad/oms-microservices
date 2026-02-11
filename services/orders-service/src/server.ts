import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { logger, AppError } from '@oms/toolkit';
import { testConnection, closeConnection } from './database/client';
import { OrderService } from './services/order.service';
import { orderRoutes } from './routes/order.routes';
import { OrderEventPublisher } from './events/publisher';
import { InventoryReservedConsumer } from './events/consumers/inventory-reserved.consumer';
import { InventoryInsufficientConsumer } from './events/consumers/inventory-insufficient.consumer';
import { PaymentCompletedConsumer } from './events/consumers/payment-completed.consumer';
import { PaymentFailedConsumer } from './events/consumers/payment-failed.consumer';
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
    const eventPublisher = new OrderEventPublisher(rabbitMQUrl);
    await eventPublisher.init();

    // Initialize services
    const orderService = new OrderService(eventPublisher);

    // Initialize event consumers
    const inventoryReservedConsumer = new InventoryReservedConsumer(orderService);
    const inventoryInsufficientConsumer = new InventoryInsufficientConsumer(orderService);
    const paymentCompletedConsumer = new PaymentCompletedConsumer(orderService);
    const paymentFailedConsumer = new PaymentFailedConsumer(orderService);

    // Setup RabbitMQ queues and start consuming
    logger.info('Setting up event consumers...');
    const channel = rabbitMQClient.getChannel();

    // Declare exchanges
    await channel.assertExchange('products', 'topic', { durable: true });
    await channel.assertExchange('payments', 'topic', { durable: true });

    // Declare queue for products events
    const productsQueueName = 'orders-service.products';
    await channel.assertQueue(productsQueueName, { durable: true });
    await channel.bindQueue(productsQueueName, 'products', 'inventory.reserved');
    await channel.bindQueue(productsQueueName, 'products', 'inventory.insufficient');

    // Declare queue for payments events
    const paymentsQueueName = 'orders-service.payments';
    await channel.assertQueue(paymentsQueueName, { durable: true });
    await channel.bindQueue(paymentsQueueName, 'payments', 'payment.completed');
    await channel.bindQueue(paymentsQueueName, 'payments', 'payment.failed');

    // Start consuming products events
    channel.consume(
      productsQueueName,
      async (msg) => {
        if (msg) {
          try {
            const event = JSON.parse(msg.content.toString());
            logger.info({ eventType: event.eventType, eventId: event.eventId }, 'Received event');

            if (event.eventType === 'inventory.reserved') {
              await inventoryReservedConsumer.handle(event);
            } else if (event.eventType === 'inventory.insufficient') {
              await inventoryInsufficientConsumer.handle(event);
            }

            channel.ack(msg);
          } catch (error) {
            logger.error({ error }, 'Failed to process event');
            channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    // Start consuming payments events
    channel.consume(
      paymentsQueueName,
      async (msg) => {
        if (msg) {
          try {
            const event = JSON.parse(msg.content.toString());
            logger.info({ eventType: event.eventType, eventId: event.eventId }, 'Received event');

            if (event.eventType === 'payment.completed') {
              await paymentCompletedConsumer.handle(event);
            } else if (event.eventType === 'payment.failed') {
              await paymentFailedConsumer.handle(event);
            }

            channel.ack(msg);
          } catch (error) {
            logger.error({ error }, 'Failed to process event');
            channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false }
    );

    logger.info('Event consumers ready');

    // Create Fastify app
    const fastify = Fastify({
      logger: false,
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
    await orderRoutes(fastify, orderService);

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      reply.send({
        status: 'healthy',
        service: 'orders-service',
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
    logger.info({ port: PORT, host: HOST }, 'Orders service started');

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
    logger.error({ error }, 'Failed to start orders service');
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
