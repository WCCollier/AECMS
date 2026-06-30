import { Module } from '@nestjs/common';
import { DomainAliasesController } from './domain-aliases.controller';
import { DomainRoutingController } from './domain-routing.controller';
import { DomainAliasesService } from './domain-aliases.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [PrismaModule, AuthModule, CapabilitiesModule],
  controllers: [DomainAliasesController, DomainRoutingController],
  providers: [DomainAliasesService],
  exports: [DomainAliasesService],
})
export class DomainAliasesModule {}
