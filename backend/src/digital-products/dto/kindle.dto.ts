import {
  IsString,
  IsUUID,
  IsEmail,
  IsBoolean,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateKindleDeviceDto {
  @IsString()
  @MaxLength(100)
  friendlyName: string;

  @IsEmail()
  @Matches(/@(kindle\.com|free\.kindle\.com)$/i, {
    message: 'Must be a valid Kindle email address (@kindle.com or @free.kindle.com)',
  })
  kindleEmail: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateKindleDeviceDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  friendlyName?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class SendToKindleDto {
  @IsUUID()
  downloadId: string;

  @IsUUID()
  @IsOptional()
  kindleDeviceId?: string;

  @IsEmail()
  @IsOptional()
  @Matches(/@(kindle\.com|free\.kindle\.com)$/i, {
    message: 'Must be a valid Kindle email address',
  })
  kindleEmail?: string;
}

export class KindleDeviceResponseDto {
  id: string;
  userId: string;
  friendlyName: string;
  kindleEmail: string;
  isDefault: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SendToKindleResultDto {
  success: boolean;
  message: string;
  kindleEmail: string;
  productName: string;
  format: string;
}
