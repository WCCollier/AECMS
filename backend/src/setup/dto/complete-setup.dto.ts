import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CompleteSetupDto {
  @IsString()
  @MaxLength(200)
  site_name: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  site_tagline?: string;

  @IsString()
  @MaxLength(100)
  first_name: string;

  @IsString()
  @MaxLength(100)
  last_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;
}
