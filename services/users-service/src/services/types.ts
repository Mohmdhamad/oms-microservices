import { PaginationParams } from '@oms/toolkit';

export interface UserForm {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ListUserRequest extends PaginationParams {
  searchTerm: string;
}