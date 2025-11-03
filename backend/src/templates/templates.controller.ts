import { Controller, Get, Param, Put, Body, UseGuards, Req, Post, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { TemplatesService } from './templates.service';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateResponseDto } from './dto/template-response.dto';

@Controller('templates')
@UseGuards(AuthGuard('supabase'))
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async getTemplates(@Req() req: AuthenticatedRequest): Promise<TemplateResponseDto[]> {
    if (!req.user?.tenantId) {
      throw new Error('Tenant ID not found in request');
    }

    return this.templatesService.getTemplatesForTenant(req.user.tenantId as string);
  }

  @Get('variables')
  getAvailableVariables() {
    return this.templatesService.getAvailableVariables();
  }

  @Get(':id')
  async getTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TemplateResponseDto> {
    if (!req.user?.tenantId) {
      throw new Error('Tenant ID not found in request');
    }

    return this.templatesService.getTemplate(req.user.tenantId as string, id);
  }

  @Put(':id')
  async updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateDto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    if (!req.user?.tenantId) {
      throw new Error('Tenant ID not found in request');
    }

    return this.templatesService.updateTemplate(req.user.tenantId as string, id, updateDto);
  }

  @Post('import/hostaway')
  async importFromHostaway(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      templates: Array<{ name?: string; description?: string; message?: string; id?: number }>;
    },
  ): Promise<{ imported: number }> {
    if (!req.user?.tenantId) {
      throw new Error('Tenant ID not found in request');
    }
    const list = Array.isArray(body?.templates) ? body.templates : [];
    await this.templatesService.importHostawayTemplates(req.user.tenantId as string, list);
    return { imported: list.length };
  }

  @Delete(':id')
  async deleteTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ deleted: boolean }> {
    if (!req.user?.tenantId) {
      throw new Error('Tenant ID not found in request');
    }
    await this.templatesService.deleteTemplate(req.user.tenantId as string, id);
    return { deleted: true };
  }
}
