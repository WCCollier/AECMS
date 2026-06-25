import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { UpdateUserRoleDto } from '../auth/dto/update-user-role.dto';

class RejectRegistrationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  reason!: string;
}

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('user.assign_role')
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all users (Owner only)' })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.authService.listUsers(
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, parseInt(limit ?? '20', 10) || 20),
      search,
    );
  }

  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change a user's role (Owner only)" })
  updateUserRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.authService.updateUserRole(req.user.id, id, dto.role as any);
  }

  @Get('pending')
  @RequiresCapability('registration.approve')
  @ApiOperation({ summary: 'List pending registrations (email-verified, not yet approved)' })
  listPending() {
    return this.authService.listPendingRegistrations();
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequiresCapability('registration.approve')
  @ApiOperation({ summary: 'Approve a pending registration' })
  approveRegistration(@Request() req: any, @Param('id') id: string) {
    return this.authService.approveRegistration(req.user.id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequiresCapability('registration.approve')
  @ApiOperation({ summary: 'Reject a pending registration (requires reason; soft-deletes account)' })
  rejectRegistration(@Request() req: any, @Param('id') id: string, @Body() dto: RejectRegistrationDto) {
    return this.authService.rejectRegistration(req.user.id, id, dto.reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequiresCapability('account.delete.any', 'account.delete.limited')
  @ApiOperation({ summary: 'Soft-delete a user account (account.delete.any or account.delete.limited)' })
  async deleteUser(@Request() req: any, @Param('id') id: string) {
    const actorCaps = (await this.capabilitiesService.getUserCapabilities(req.user.id))
      .map((c: { name: string }) => c.name);
    return this.authService.deleteUser(req.user.id, id, actorCaps);
  }
}
