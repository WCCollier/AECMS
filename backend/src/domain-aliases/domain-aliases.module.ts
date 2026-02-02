import { Module } from '@nestjs/common';
import { DomainAliasesController } from './domain-aliases.controller';
import { DomainAliasesService } from './domain-aliases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DomainAliasesController],
  providers: [DomainAliasesService],
  exports: [DomainAliasesService],
})
export class DomainAliasesModule {}
