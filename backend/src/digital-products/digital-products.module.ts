import { Module } from '@nestjs/common';
import { DigitalProductsController } from './digital-products.controller';
import { DigitalProductsService } from './digital-products.service';
import { PersonalizationService } from './personalization.service';
import { KindleController } from './kindle.controller';
import { KindleService } from './kindle.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

/**
 * Digital Products Module
 *
 * Handles digital product files, downloads, and personalization.
 *
 * Features:
 * - Upload EPUB/PDF files for digital products
 * - Generate secure download tokens after purchase
 * - Track download counts with limits
 * - Personalize files with customer information
 * - Send to Kindle functionality
 */
@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [DigitalProductsController, KindleController],
  providers: [
    DigitalProductsService,
    PersonalizationService,
    KindleService,
  ],
  exports: [DigitalProductsService, PersonalizationService, KindleService],
})
export class DigitalProductsModule {}
