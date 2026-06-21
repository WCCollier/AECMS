import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaSyncService } from './media-sync.service';
import { MediaController } from './media.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [PrismaModule, CapabilitiesModule],
  controllers: [MediaController],
  providers: [MediaService, MediaSyncService],
  exports: [MediaService, MediaSyncService],
})
export class MediaModule {}
