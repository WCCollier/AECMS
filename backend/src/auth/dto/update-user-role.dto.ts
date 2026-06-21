import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsIn(['member', 'admin', 'owner'])
  role: 'member' | 'admin' | 'owner';
}
