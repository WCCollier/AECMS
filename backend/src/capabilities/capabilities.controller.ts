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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { AssignCapabilityToRoleDto, AssignCapabilityToUserDto } from './dto';

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
  @ApiParam({ name: 'role', enum: UserRole })
  @ApiResponse({ status: 200, description: 'Returns role capabilities' })
  async getRoleCapabilities(@Param('role') role: UserRole) {
    return this.capabilitiesService.getRoleCapabilities(role);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get capabilities for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Returns user capabilities' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserCapabilities(@Param('userId') userId: string) {
    return this.capabilitiesService.getUserCapabilities(userId);
  }

  @Post('roles/:role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Assign capability to role (Owner only)' })
  @ApiParam({ name: 'role', enum: UserRole })
  @ApiResponse({ status: 201, description: 'Capability assigned successfully' })
  @ApiResponse({ status: 404, description: 'Capability not found' })
  @ApiResponse({ status: 409, description: 'Capability already assigned' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  async assignCapabilityToRole(
    @Param('role') role: UserRole,
    @Body() dto: AssignCapabilityToRoleDto,
  ) {
    return this.capabilitiesService.assignCapabilityToRole(role, dto.capability_id);
  }

  @Delete('roles/:role/:capabilityId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.owner)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove capability from role (Owner only)' })
  @ApiParam({ name: 'role', enum: UserRole })
  @ApiParam({ name: 'capabilityId', description: 'Capability ID' })
  @ApiResponse({ status: 204, description: 'Capability removed successfully' })
  @ApiResponse({ status: 404, description: 'Role capability not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  async removeCapabilityFromRole(
    @Param('role') role: UserRole,
    @Param('capabilityId') capabilityId: string,
  ) {
    await this.capabilitiesService.removeCapabilityFromRole(role, capabilityId);
  }

  @Post('users/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Assign capability to user (Owner only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 201, description: 'Capability assigned successfully' })
  @ApiResponse({ status: 404, description: 'User or capability not found' })
  @ApiResponse({ status: 409, description: 'Capability already assigned' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.owner)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove capability from user (Owner only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'capabilityId', description: 'Capability ID' })
  @ApiResponse({ status: 204, description: 'Capability removed successfully' })
  @ApiResponse({ status: 404, description: 'User capability not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  async removeCapabilityFromUser(
    @Param('userId') userId: string,
    @Param('capabilityId') capabilityId: string,
  ) {
    await this.capabilitiesService.removeCapabilityFromUser(userId, capabilityId);
  }
}
