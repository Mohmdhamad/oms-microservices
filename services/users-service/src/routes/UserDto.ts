import { boolean, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export class UserDto {
  id: number|null;
  email: string;
  password: string;
  firstName: string;
  lastName: string
}