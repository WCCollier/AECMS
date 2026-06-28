import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  private async encryptAddress(dto: { full_name?: string; street: string; city: string; postal_code: string }) {
    return {
      full_name_enc: dto.full_name ? await this.encryption.encrypt(dto.full_name) : null,
      street_enc: await this.encryption.encrypt(dto.street) as string,
      city_enc: await this.encryption.encrypt(dto.city) as string,
      postal_code_enc: await this.encryption.encrypt(dto.postal_code) as string,
    };
  }

  private async decryptAddress(row: any) {
    return {
      id: row.id,
      label: row.label ?? null,
      full_name: row.full_name_enc ? await this.encryption.decrypt(row.full_name_enc) : null,
      street: (await this.encryption.decrypt(row.street_enc)) ?? '',
      city: (await this.encryption.decrypt(row.city_enc)) ?? '',
      state: row.state,
      postal_code: (await this.encryption.decrypt(row.postal_code_enc)) ?? '',
      country: row.country,
      is_default: row.is_default,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.userAddress.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.decryptAddress(r)));
  }

  async findDefault(userId: string) {
    const row = await this.prisma.userAddress.findFirst({
      where: { user_id: userId, is_default: true },
    });
    if (!row) return null;
    return this.decryptAddress(row);
  }

  async create(userId: string, dto: CreateAddressDto) {
    const encrypted = await this.encryptAddress({
      full_name: dto.full_name,
      street: dto.street,
      city: dto.city,
      postal_code: dto.postal_code,
    });

    return this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.userAddress.updateMany({ where: { user_id: userId }, data: { is_default: false } });
      }
      const row = await tx.userAddress.create({
        data: {
          user_id: userId,
          label: dto.label ?? null,
          ...encrypted,
          state: dto.state,
          country: dto.country,
          is_default: dto.is_default ?? false,
        },
      });
      return this.decryptAddress(row);
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.user_id !== userId) throw new ForbiddenException();

    const partialEncrypted: Record<string, any> = {};
    if (dto.full_name !== undefined) partialEncrypted.full_name_enc = dto.full_name ? await this.encryption.encrypt(dto.full_name) : null;
    if (dto.street !== undefined) partialEncrypted.street_enc = await this.encryption.encrypt(dto.street);
    if (dto.city !== undefined) partialEncrypted.city_enc = await this.encryption.encrypt(dto.city);
    if (dto.postal_code !== undefined) partialEncrypted.postal_code_enc = await this.encryption.encrypt(dto.postal_code);

    return this.prisma.$transaction(async (tx) => {
      if (dto.is_default) {
        await tx.userAddress.updateMany({ where: { user_id: userId }, data: { is_default: false } });
      }
      const row = await tx.userAddress.update({
        where: { id },
        data: {
          label: dto.label,
          state: dto.state,
          country: dto.country,
          is_default: dto.is_default,
          ...partialEncrypted,
        },
      });
      return this.decryptAddress(row);
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.user_id !== userId) throw new ForbiddenException();
    await this.prisma.userAddress.delete({ where: { id } });
  }

  async setDefault(userId: string, id: string) {
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.user_id !== userId) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      await tx.userAddress.updateMany({ where: { user_id: userId }, data: { is_default: false } });
      const row = await tx.userAddress.update({ where: { id }, data: { is_default: true } });
      return this.decryptAddress(row);
    });
  }
}
