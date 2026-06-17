import { Module } from '@nestjs/common';
import { ExternalFeedsService } from './external-feeds.service';
import { ExternalFeedsController } from './external-feeds.controller';

@Module({
  controllers: [ExternalFeedsController],
  providers: [ExternalFeedsService],
  exports: [ExternalFeedsService],
})
export class ExternalFeedsModule {}
