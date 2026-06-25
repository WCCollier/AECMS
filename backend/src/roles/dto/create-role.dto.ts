import { IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'Role name must be lowercase letters, digits, or hyphens' })
  name: string;

  @IsString()
  label: string;
}
