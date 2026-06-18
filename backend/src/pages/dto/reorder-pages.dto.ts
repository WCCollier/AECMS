import { IsArray, IsString, IsInt, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PageOrderItemDto {
  @IsString()
  id: string;

  @IsInt()
  @Min(0)
  nav_order: number;
}

export class ReorderPagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageOrderItemDto)
  pages: PageOrderItemDto[];
}
