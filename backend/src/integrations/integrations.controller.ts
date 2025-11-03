import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { IntegrationsService } from './integrations.service';
import { HostawayIntegrationDto } from './dto/hostaway-integration.dto';
import { TwilioIntegrationDto } from './dto/twilio-integration.dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('hostaway')
  @UseGuards(AuthGuard('supabase'))
  async configureHostaway(
    @Req() req: AuthenticatedRequest,
    @Body() payload: HostawayIntegrationDto,
  ) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    try {
      await this.integrationsService.configureHostaway(req.user.userId, payload);
      return {
        status: 'connected',
      };
    } catch (error) {
      console.error('Hostaway configuration error:', error);
      throw error;
    }
  }

  @Get('hostaway')
  @UseGuards(AuthGuard('supabase'))
  async getHostawayStatus(@Req() req: AuthenticatedRequest) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return this.integrationsService.getHostawayStatus(req.user.userId);
  }

  @Get('hostaway/webhook-status')
  @UseGuards(AuthGuard('supabase'))
  async getWebhookStatus(@Req() req: AuthenticatedRequest) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return this.integrationsService.verifyWebhookStatus(req.user.userId);
  }

  @Get('hostaway/message-templates')
  @UseGuards(AuthGuard('supabase'))
  async listHostawayMessageTemplates(
    @Req() req: AuthenticatedRequest,
    @Query('listingMapId') listingMapId?: string,
    @Query('channelId') channelId?: string,
    @Query('messageTemplateGroupId') messageTemplateGroupId?: string,
    @Query('reservationId') reservationId?: string,
  ) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }
    return this.integrationsService.listHostawayMessageTemplates(req.user.userId, {
      listingMapId,
      channelId,
      messageTemplateGroupId,
      reservationId,
    });
  }

  @Post('hostaway/resync')
  @UseGuards(AuthGuard('supabase'))
  async triggerResync(@Req() req: AuthenticatedRequest) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return this.integrationsService.triggerResync(req.user.userId);
  }

  @Post('twilio')
  @UseGuards(AuthGuard('supabase'))
  async configureTwilio(@Req() req: AuthenticatedRequest, @Body() payload: TwilioIntegrationDto) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    try {
      await this.integrationsService.configureTwilio(req.user.userId, payload);
      return {
        status: 'connected',
      };
    } catch (error) {
      console.error('Twilio configuration error:', error);
      throw error;
    }
  }

  @Get('twilio')
  @UseGuards(AuthGuard('supabase'))
  async getTwilioStatus(@Req() req: AuthenticatedRequest) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    return this.integrationsService.getTwilioStatus(req.user.userId);
  }
}
