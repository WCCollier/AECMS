import { IsString, MinLength, MaxLength } from 'class-validator';

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;
}
