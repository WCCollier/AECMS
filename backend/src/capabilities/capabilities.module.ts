import { Module } from '@nestjs/common';
import { CapabilitiesService } from './capabilities.service';
import { CapabilitiesController } from './capabilities.controller';
import { CapabilityGuard } from './guards/capability.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CapabilitiesController],
  providers: [CapabilitiesService, CapabilityGuard],
  exports: [CapabilitiesService, CapabilityGuard],
})
export class CapabilitiesModule {}
