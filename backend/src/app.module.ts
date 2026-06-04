import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { MediaModule } from './media/media.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { ArticlesModule } from './articles/articles.module';
import { PagesModule } from './pages/pages.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CommentsModule } from './comments/comments.module';
import { StorageModule } from './storage/storage.module';
import { EmailModule } from './email/email.module';
import { DigitalProductsModule } from './digital-products/digital-products.module';
import { DomainAliasesModule } from './domain-aliases/domain-aliases.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: '.env',
    }),
    // Serve WordPress uploads directory for migrated content
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          // Serve files from the uploads directory
          // In Docker: /app/uploads, in local dev: ../uploads relative to backend
          rootPath: configService.get<string>(
            'UPLOADS_PATH',
            path.join(process.cwd(), 'uploads'),
          ),
          // Files will be accessible at /uploads/...
          serveRoot: '/uploads',
          // Don't serve index.html for directories
          serveStaticOptions: {
            index: false,
          },
        },
      ],
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    CapabilitiesModule,
    MediaModule,
    CategoriesModule,
    TagsModule,
    ArticlesModule,
    PagesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    CommentsModule,
    StorageModule,
    EmailModule,
    DigitalProductsModule,
    DomainAliasesModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
