/**
 * Generic RabbitMQ client - no service-specific logic
 */
import amqp from 'amqplib';
import { Channel, Connection } from 'amqplib';

export class RabbitMQClient {
  private static instance: RabbitMQClient;
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected: boolean = false;

  private constructor(private connectionUrl: string) {}

  public static getInstance(connectionUrl: string): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient(connectionUrl);
    }
    return RabbitMQClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.connection && this.channel) return;
    this.connection = await amqp.connect(this.connectionUrl);
    this.channel = await this.connection.createChannel();
    this.isConnected = true;
  }

  public getChannel(): Channel {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.isConnected = false;
  }
}
