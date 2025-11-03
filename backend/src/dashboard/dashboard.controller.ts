import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('supabase'))
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getSummary(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getSummary(req.user.userId);
  }
}
