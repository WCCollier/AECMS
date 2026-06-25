import { IsArray, IsString } from 'class-validator';

export class SetRoleCapabilitiesDto {
  @IsArray()
  @IsString({ each: true })
  capability_ids: string[];
}
