import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CapabilitiesService } from './capabilities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AssignCapabilityToRoleDto, AssignCapabilityToUserDto } from './dto';
import { CapabilityGuard } from './guards/capability.guard';
import { RequiresCapability } from './decorators/requires-capability.decorator';

@ApiTags('capabilities')
@Controller('capabilities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CapabilitiesController {
  constructor(private readonly capabilitiesService: CapabilitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all capabilities' })
  @ApiResponse({ status: 200, description: 'Returns all capabilities' })
  async getAllCapabilities() {
    return this.capabilitiesService.getAllCapabilities();
  }

  @Get('roles/:role')
  @ApiOperation({ summary: 'Get capabilities for a specific role' })
  @ApiParam({ name: 'role', description: 'Role name (owner, admin, member, guest, or custom)' })
  @ApiResponse({ status: 200, description: 'Returns role capabilities' })
  async getRoleCapabilities(@Param('role') role: string) {
    return this.capabilitiesService.getRoleCapabilities(role);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get capabilities for a specific user (own caps: any auth; others: backstage required)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user capabilities' })
  @ApiResponse({ status: 403, description: 'Backstage session required to view other users\' capabilities' })
  async getUserCapabilities(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: any,
  ) {
    if (userId !== currentUser.id && currentUser.session_type !== 'backstage') {
      throw new ForbiddenException('Backstage session required to view other users\' capabilities');
    }
    return this.capabilitiesService.getUserCapabilities(userId);
  }

  @Post('roles/:role')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('system.configure')
  @ApiOperation({ summary: 'Assign capability to role (Owner only)' })
  @ApiParam({ name: 'role', description: 'Role name' })
  @ApiResponse({ status: 201, description: 'Capability assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - backstage session + system.configure required' })
  async assignCapabilityToRole(
    @Param('role') role: string,
    @Body() dto: AssignCapabilityToRoleDto,
  ) {
    return this.capabilitiesService.assignCapabilityToRole(role, dto.capability_id);
  }

  @Delete('roles/:role/:capabilityId')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('system.configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove capability from role (Owner only)' })
  @ApiParam({ name: 'role', description: 'Role name' })
  @ApiParam({ name: 'capabilityId', description: 'Capability ID' })
  @ApiResponse({ status: 204, description: 'Capability removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - backstage session + system.configure required' })
  async removeCapabilityFromRole(
    @Param('role') role: string,
    @Param('capabilityId') capabilityId: string,
  ) {
    await this.capabilitiesService.removeCapabilityFromRole(role, capabilityId);
  }

  @Post('users/:userId')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('system.configure')
  @ApiOperation({ summary: 'Assign capability to user (Owner only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Capability assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - backstage session + system.configure required' })
  async assignCapabilityToUser(
    @CurrentUser() currentUser: any,
    @Param('userId') userId: string,
    @Body() dto: AssignCapabilityToUserDto,
  ) {
    return this.capabilitiesService.assignCapabilityToUser(
      userId,
      dto.capability_id,
      currentUser.id,
    );
  }

  @Delete('users/:userId/:capabilityId')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('system.configure')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove capability from user (Owner only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'capabilityId', description: 'Capability ID' })
  @ApiResponse({ status: 204, description: 'Capability removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - backstage session + system.configure required' })
  async removeCapabilityFromUser(
    @Param('userId') userId: string,
    @Param('capabilityId') capabilityId: string,
  ) {
    await this.capabilitiesService.removeCapabilityFromUser(userId, capabilityId);
  }
}
