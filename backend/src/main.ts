import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import express from 'express';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env with override: true so file values win over Codespaces injected secrets.
// This lets us update STRIPE_WEBHOOK_SECRET in .env without restarting the Codespace.
dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true });

function getAllowedOrigins(): string[] {
  const origins = [
    'http://localhost:3000',
    'http://localhost:4000',
  ];

  if (process.env.CODESPACES === 'true' && process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    origins.push(`https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    origins.push(`https://${process.env.CODESPACE_NAME}-4000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
  }

  return origins;
}

async function bootstrap() {
  // Disable NestJS's built-in body parser so we can apply express.raw() for
  // the Stripe webhook endpoint before express.json() parses everything else.
  // Stripe's signature verification requires the exact raw bytes of the body.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Raw buffer for Stripe webhooks — must be registered before express.json().
  app.use(
    '/payments/webhooks/stripe',
    express.raw({ type: 'application/json' }),
  );

  // JSON parser for all other endpoints.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  console.log(`Backend running on port ${port}`);
}
bootstrap();
