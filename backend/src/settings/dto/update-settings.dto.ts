import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @IsObject()
  updates: Record<string, string>;
}
