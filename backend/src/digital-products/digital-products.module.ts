import { Module } from '@nestjs/common';
import { DigitalProductsController } from './digital-products.controller';
import { DigitalProductsService } from './digital-products.service';
import { PersonalizationService } from './personalization.service';
import { KindleController } from './kindle.controller';
import { KindleService } from './kindle.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule, AuthModule, CapabilitiesModule],
  controllers: [DigitalProductsController, KindleController],
  providers: [
    DigitalProductsService,
    PersonalizationService,
    KindleService,
  ],
  exports: [DigitalProductsService, PersonalizationService, KindleService],
})
export class DigitalProductsModule {}
