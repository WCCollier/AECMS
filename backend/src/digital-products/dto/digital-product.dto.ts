import {
  IsString,
  IsUUID,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export enum FileFormat {
  EPUB = 'epub',
  PDF = 'pdf',
}

export class CreateDigitalFileDto {
  @IsUUID()
  productId: string;

  @IsEnum(FileFormat)
  format: FileFormat;

  @IsBoolean()
  @IsOptional()
  personalizationEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxDownloads?: number;
}

export class UpdateDigitalFileDto {
  @IsBoolean()
  @IsOptional()
  personalizationEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxDownloads?: number;
}

export class DigitalFileResponseDto {
  id: string;
  productId: string;
  format: string;
  fileId: string;
  personalizationEnabled: boolean;
  maxDownloads: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DigitalDownloadResponseDto {
  id: string;
  digitalFileId: string;
  orderId: string;
  downloadToken: string;
  downloadCount: number;
  maxDownloads: number;
  expiresAt: Date;
  createdAt: Date;
  lastDownloadedAt: Date | null;
  format: string;
  productName: string;
}

export class CreateDownloadTokenDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  digitalFileId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxDownloads?: number;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  expiryDays?: number;
}

export class PersonalizationOptionsDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsString()
  @IsOptional()
  purchaseDate?: string;
}
