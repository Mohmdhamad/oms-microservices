import { randomUUID } from 'crypto';

export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  version: string;
  source: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  traceId?: string;
}

export function createEvent(
    type: string,
    payload: Record<string, any>,
    source: string,
    metadata?: EventMetadata
): BaseEvent {
  return {
    id: randomUUID(),
    type,
    timestamp: new Date(),
    version: '1.0.0',
    source,
    payload,
    metadata,
  };
}
