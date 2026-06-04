import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, QueryProductsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all products with filtering and pagination' })
  findAll(@Query() query: QueryProductsDto, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.productsService.findAll(query, user?.id, isAdmin);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get product by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.productsService.findById(id, user?.id, isAdmin);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get product by slug' })
  findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.productsService.findBySlug(slug, user?.id, isAdmin);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    return this.productsService.update(id, dto, user.id, isAdmin);
  }

  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product stock' })
  updateStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    return this.productsService.updateStock(id, quantity, isAdmin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.delete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    return this.productsService.remove(id, isAdmin);
  }

  @Get(':id/versions')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List product versions' })
  getVersions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.getVersions(id, page, limit);
  }

  @Get(':id/versions/:vnum')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific product version' })
  getVersion(@Param('id') id: string, @Param('vnum') vnum: string) {
    return this.productsService.getVersion(id, parseInt(vnum, 10));
  }

  @Post(':id/versions/:vnum/restore')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('product.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore product to a previous version' })
  restoreVersion(
    @Param('id') id: string,
    @Param('vnum') vnum: string,
    @CurrentUser() user: any,
  ) {
    return this.productsService.restoreVersion(id, parseInt(vnum, 10), user.id);
  }
}
