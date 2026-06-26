import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  subscribe_new_articles?: boolean;

  @IsOptional()
  @IsBoolean()
  subscribe_new_products?: boolean;

  @IsOptional()
  @IsBoolean()
  subscribe_news_alerts?: boolean;
}
