import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';

@Module({
  imports: [AuthModule, CapabilitiesModule],
  controllers: [UsersController],
})
export class UsersModule {}
