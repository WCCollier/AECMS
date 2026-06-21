import { Module } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [PrismaModule, CapabilitiesModule, MediaModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
