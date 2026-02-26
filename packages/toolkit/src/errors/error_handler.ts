import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from './index';
import { logger } from '../logger';

const errorHandler: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Log the original error for debugging purposes
    logger.error(
        {
          err: error,
          url: request.url,
          method: request.method,
        },
        'Unhandled error occurred'
    );

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code ?? 'APPLICATION_ERROR',
          message: error.message,
          details: error.details ?? null,
        },
      });
    }

    // Handle PostgreSQL unique constraint violation (code 23505)
    if ((error as any).code === '23505') {
      const detail = (error as any).detail as string | undefined;

      // Extracts the value from a detail string like: "Key (email)=(some@email.com) already exists."
      const valueMatch = detail?.match(/\)=\((.*?)\)/);
      let value = 'Resource'; // Default fallback
      if (valueMatch && valueMatch[1]) {
        value = valueMatch[1]; // Extracts 'some@email.com'
      }

      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: `(${value}) already exists.`,
        },
      });
    }

    // Handle schema validation errors
    if ((error as any).validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: (error as any).validation,
        },
      });
    }

    // Generic fallback for all other errors
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
};

export default fp(errorHandler);
