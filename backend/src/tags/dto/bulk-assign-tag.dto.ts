import { IsArray, IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAssignTagDto {
  @ApiPropertyOptional({ description: 'Article IDs to assign this tag to', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  article_ids?: string[];

  @ApiPropertyOptional({ description: 'Product IDs to assign this tag to', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  product_ids?: string[];
}
