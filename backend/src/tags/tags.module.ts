import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [PrismaModule, CapabilitiesModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
