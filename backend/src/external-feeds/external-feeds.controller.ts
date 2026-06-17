import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExternalFeedsService } from './external-feeds.service';

@ApiTags('external-feeds')
@Controller('external-feeds')
export class ExternalFeedsController {
  constructor(private svc: ExternalFeedsService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview RSS feed items (cached 15 min)' })
  preview(
    @Query('url') url: string,
    @Query('count') count?: string,
    @Query('item_url') itemUrl?: string,
  ) {
    return this.svc.preview(url, count ? parseInt(count, 10) : 3, itemUrl);
  }
}
