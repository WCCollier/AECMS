import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List all saved addresses for the current user' })
  list(@Request() req: any) {
    return this.addressesService.list(req.user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default address (or null)' })
  getDefault(@Request() req: any) {
    return this.addressesService.findDefault(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new saved address' })
  create(@Request() req: any, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved address' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a saved address' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.addressesService.remove(req.user.id, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set an address as the default' })
  setDefault(@Request() req: any, @Param('id') id: string) {
    return this.addressesService.setDefault(req.user.id, id);
  }
}
