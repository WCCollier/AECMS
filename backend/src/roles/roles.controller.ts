import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRoleCapabilitiesDto } from './dto/set-role-capabilities.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('role.manage')
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':name')
  update(@Param('name') name: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(name, dto);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('name') name: string) {
    return this.rolesService.remove(name);
  }

  @Get(':name/capabilities')
  getCapabilities(@Param('name') name: string) {
    return this.rolesService.getCapabilities(name);
  }

  @Put(':name/capabilities')
  setCapabilities(@Param('name') name: string, @Body() dto: SetRoleCapabilitiesDto) {
    return this.rolesService.setCapabilities(name, dto.capability_ids);
  }

  @Get(':name/members')
  getMembers(@Param('name') name: string) {
    return this.rolesService.getMembers(name);
  }
}
