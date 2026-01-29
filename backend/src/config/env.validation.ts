import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsUrl,
  IsOptional,
  validateSync,
  Min,
  Max,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  PORT?: number = 4000;

  // Database
  @IsString()
  DATABASE_URL: string;

  // Redis
  @IsString()
  REDIS_URL: string;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  @IsString()
  REFRESH_TOKEN_EXPIRATION: string;

  // URLs
  @IsUrl({ require_tld: false })
  APP_URL: string;

  @IsUrl({ require_tld: false })
  API_URL: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;

  @IsUrl({ require_tld: false })
  FRONTEND_ADMIN_URL: string;

  // Codespaces (optional)
  @IsString()
  @IsOptional()
  CODESPACES?: string;

  @IsString()
  @IsOptional()
  CODESPACE_NAME?: string;

  @IsString()
  @IsOptional()
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?: string;

  // OAuth (optional for Phase 1)
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  APPLE_CLIENT_SECRET?: string;

  // Payment providers (optional for Phase 1)
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  PAYPAL_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  PAYPAL_CLIENT_SECRET?: string;

  @IsEnum(['sandbox', 'live'])
  @IsOptional()
  PAYPAL_MODE?: string = 'sandbox';

  // AI moderation (optional for Phase 1)
  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  // AWS SES (optional for Phase 1)
  @IsString()
  @IsOptional()
  AWS_SES_REGION?: string = 'us-east-1';

  @IsString()
  @IsOptional()
  AWS_SES_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SES_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_SES_FROM_EMAIL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
