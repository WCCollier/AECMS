import { IsString, MinLength, Matches } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z][a-z0-9-]*$/, { message: 'Role name must be lowercase letters, digits, or hyphens' })
  role: string;
}
