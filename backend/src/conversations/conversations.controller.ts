import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { AuthGuard } from '@nestjs/passport';
import { TenantService, TenantSummary } from '../tenant/tenant.service';
import {
  ConversationDetail,
  ConversationSummary,
  ConversationsService,
} from './conversations.service';
import { HumanReplyDto } from './dto/human-reply.dto';

@Controller('conversations')
@UseGuards(AuthGuard('supabase'))
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('days') days?: string,
  ): Promise<{ conversations: ConversationSummary[]; total: number }> {
    const tenant = await this.getTenant(req);
    return this.conversationsService.listConversations(tenant.id, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      status: status as 'automated' | 'paused_by_human' | undefined,
      days: days ? parseInt(days, 10) : 365, // Default: next 365 days (show all upcoming)
    });
  }

  @Get(':id')
  async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/reply')
  async humanReply(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() dto: HumanReplyDto,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.sendHumanReply(tenant, conversationId, dto.message);
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/send-template')
  async sendTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() body: { templateId: string },
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.sendTemplateReply(tenant, conversationId, body.templateId);
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/pause')
  async pause(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.setStatus(tenant.id, conversationId, 'paused_by_human');
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/resume')
  async resume(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.setStatus(tenant.id, conversationId, 'automated');
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/messages/:messageId/cancel')
  async cancelMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.cancelPendingMessage(tenant.id, conversationId, messageId);
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/messages/cancel-all')
  async cancelAllMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ): Promise<ConversationDetail> {
    const tenant = await this.getTenant(req);
    await this.conversationsService.cancelAllPendingMessages(tenant.id, conversationId);
    return this.conversationsService.getConversationDetail(tenant.id, conversationId);
  }

  @Post(':id/sync-history')
  async syncHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenant = await this.getTenant(req);
    const conversation = await this.conversationsService.getConversationById(
      tenant.id,
      conversationId,
    );

    if (!conversation.bookingExternalId) {
      throw new BadRequestException('Conversation is not linked to a Hostaway reservation');
    }

    await this.conversationsService.syncConversationHistory(
      tenant.id,
      conversationId,
      conversation.bookingExternalId,
    );

    return {
      success: true,
      message: 'Conversation history synced successfully',
    };
  }

  private async getTenant(req: AuthenticatedRequest): Promise<TenantSummary> {
    return this.tenantService.getTenantForUser(req.user.userId);
  }
}
