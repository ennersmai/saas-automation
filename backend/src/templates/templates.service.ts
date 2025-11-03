import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateResponseDto, AVAILABLE_VARIABLES } from './dto/template-response.dto';

export type ProactiveMessageType =
  | 'thank_you_immediate'
  | 'pre_arrival_24h'
  | 'door_code_3h'
  | 'same_day_checkin'
  | 'checkout_morning'
  | 'pre_checkout_evening'
  | 'message_received_keyword'
  | 'host_message_reply';

interface TemplateRow {
  id: string;
  tenant_id: string;
  trigger_type: string;
  name: string;
  template_body: string;
  enabled: boolean;
  variables: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async importHostawayTemplates(
    tenantId: string,
    templates: Array<{ name?: string; description?: string; message?: string; id?: number }>,
  ): Promise<void> {
    for (const t of templates) {
      const name = (t.name ?? `Imported ${t.id ?? ''}`).toString();
      const rawBody = (t.message ?? '').toString();
      const mappedBody = this.mapPlaceholders(rawBody);
      await this.upsertTemplate(tenantId, name, mappedBody);
    }
  }

  private async upsertTemplate(
    tenantId: string,
    name: string,
    templateBody: string,
  ): Promise<void> {
    const triggerType = 'custom_hostaway';

    await this.databaseService.runQuery(
      `insert into public.message_templates (tenant_id, trigger_type, name, template_body, enabled, variables, updated_at)
       values ($1, $2, $3, $4, false, '{}'::jsonb, now())
       on conflict (tenant_id, trigger_type, name)
       do update set template_body = excluded.template_body,
                     updated_at = now()`,
      [tenantId, triggerType, name, templateBody],
    );
  }

  async getTemplatesForTenant(tenantId: string): Promise<TemplateResponseDto[]> {
    const query = `
      SELECT id, tenant_id, trigger_type, name, template_body, enabled, variables, created_at, updated_at
      FROM public.message_templates
      WHERE tenant_id = $1
      ORDER BY trigger_type
    `;

    const result = await this.databaseService.runQuery(query, [tenantId]);
    return result.rows.map(this.mapRowToDto);
  }

  async getTemplate(tenantId: string, templateId: string): Promise<TemplateResponseDto> {
    const query = `
      SELECT id, tenant_id, trigger_type, name, template_body, enabled, variables, created_at, updated_at
      FROM public.message_templates
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.databaseService.runQuery(query, [templateId, tenantId]);

    if (result.rows.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return this.mapRowToDto(result.rows[0]);
  }

  async updateTemplate(
    tenantId: string,
    templateId: string,
    updateDto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    // Map Hostaway placeholders to internal variables before save
    const mappedBody = this.mapPlaceholders(updateDto.template_body);

    const triggerType = updateDto.trigger_type;
    const query = `
      UPDATE public.message_templates
      SET template_body = $1,
          enabled = COALESCE($2, enabled),
          trigger_type = COALESCE($3, trigger_type),
          variables = COALESCE($4::jsonb, variables),
          updated_at = now()
      WHERE id = $5 AND tenant_id = $6
      RETURNING id, tenant_id, trigger_type, name, template_body, enabled, variables, created_at, updated_at
    `;

    const result = await this.databaseService.runQuery(query, [
      mappedBody,
      updateDto.enabled,
      triggerType,
      updateDto.variables ? JSON.stringify(updateDto.variables) : null,
      templateId,
      tenantId,
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return this.mapRowToDto(result.rows[0]);
  }

  private mapPlaceholders(input: string): string {
    if (!input) return input;
    const replacements: Record<string, string> = {
      '{{guest_first_name}}': '{{guestName}}',
      '{{guest_portal_url}}': '{{guestPortalUrl}}',
      '{{checkin_date_day}}': '{{checkInDate}}',
      '{{checkout_date_day}}': '{{checkOutDate}}',
      '{{channel_property_id}}': '{{propertyName}}',
      '{{cc_name}}': '{{guestName}}',
    };
    let out = input;
    for (const [from, to] of Object.entries(replacements)) {
      out = out.split(from).join(to);
    }
    return out;
  }

  async getTemplateForMessage(
    tenantId: string,
    messageType: ProactiveMessageType,
  ): Promise<TemplateResponseDto | null> {
    const query = `
      SELECT id, tenant_id, trigger_type, name, template_body, enabled, variables, created_at, updated_at
      FROM public.message_templates
      WHERE tenant_id = $1 AND trigger_type = $2 AND enabled = true
    `;

    const result = await this.databaseService.runQuery(query, [tenantId, messageType]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDto(result.rows[0]);
  }

  async ensureDefaultTemplates(tenantId: string): Promise<void> {
    const query = `
      SELECT COUNT(*) as count
      FROM public.message_templates
      WHERE tenant_id = $1
    `;

    const result = await this.databaseService.runQuery(query, [tenantId]);
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
      this.logger.log(`Creating default message templates for tenant ${tenantId}`);
      await this.databaseService.runQuery('SELECT create_default_message_templates($1)', [
        tenantId,
      ]);
    }
  }

  getAvailableVariables(): typeof AVAILABLE_VARIABLES {
    return AVAILABLE_VARIABLES;
  }

  substituteVariables(
    template: string,
    variables: Record<string, string | number | null | undefined>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = value?.toString() ?? '';
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return result;
  }

  private mapRowToDto(row: TemplateRow): TemplateResponseDto {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      trigger_type: row.trigger_type,
      name: row.name,
      template_body: row.template_body,
      enabled: row.enabled,
      variables: row.variables,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<void> {
    await this.databaseService.runQuery(
      `delete from public.message_templates where id = $1 and tenant_id = $2`,
      [templateId, tenantId],
    );
  }
}
