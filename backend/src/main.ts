import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function getAllowedOrigins(): string[] {
  const origins = [
    'http://localhost:3000',
    'http://localhost:4000',
  ];

  if (process.env.CODESPACES === 'true' && process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    const base = `${process.env.CODESPACE_NAME}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
    origins.push(`https://${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    origins.push(`https://${process.env.CODESPACE_NAME}-4000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
