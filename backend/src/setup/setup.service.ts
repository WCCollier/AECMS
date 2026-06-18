import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CompleteSetupDto } from './dto/complete-setup.dto';

@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    const owner = await this.prisma.user.findFirst({ where: { role: 'owner' } });
    return owner === null;
  }

  async completeSetup(dto: CompleteSetupDto): Promise<void> {
    const required = await this.isSetupRequired();
    if (!required) {
      throw new ConflictException('Setup has already been completed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const owner = await this.prisma.user.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        first_name: dto.first_name,
        last_name: dto.last_name,
        role: 'owner',
        email_verified: true,
      },
    });

    // Write site identity — these keys are not encrypted, so KeyProvider is not invoked
    const siteUpdates: Record<string, string> = {
      'general.site_title': dto.site_name,
    };
    if (dto.site_tagline !== undefined) {
      siteUpdates['general.tagline'] = dto.site_tagline;
    }
    await this.settings.set(siteUpdates, owner.id);
  }
}
