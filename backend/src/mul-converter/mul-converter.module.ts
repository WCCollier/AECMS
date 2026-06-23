import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { MediaModule } from '../media/media.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { MulConverterController } from './mul-converter.controller';
import { MulConverterService } from './mul-converter.service';

@Module({
  imports: [SettingsModule, MediaModule, CapabilitiesModule],
  controllers: [MulConverterController],
  providers: [MulConverterService],
})
export class MulConverterModule {}
