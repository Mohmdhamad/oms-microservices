import { User } from '../database/schema';
import { UserForm } from './types';

export function userEntityToForm(entity: User): UserForm {
  const userForm = {} as UserForm;
  userForm.id = entity.id;
  userForm.firstName = entity.firstName;
  userForm.lastName = entity.lastName;
  userForm.email = entity.email;
  return userForm;
}