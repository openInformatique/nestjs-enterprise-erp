import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { GetDashboardUseCase } from '../application/get-dashboard.use-case';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

/**
 * Contrôleur du tableau de bord — UNE route, TOUT l'écran.
 * ADMIN/MANAGER : les chiffres d'affaires et créances ne sont pas de
 * la consultation d'équipe.
 */
@ApiTags('Tableau de bord')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.Manager)
  @ApiOperation({
    summary: 'Toutes les métriques en un appel',
    description:
      'CA (mois courant / précédent / YTD), créances par statut, ' +
      'commandes actives, pipe des devis, top 5 clients, activité ' +
      'récente, alertes de stock. Calculé à la volée (8 requêtes en ' +
      'parallèle), aucun cache.',
  })
  @ApiOkResponse({ type: DashboardResponseDto })
  async getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    const metrics = await this.getDashboardUseCase.execute(
      query.stockAlertThreshold,
    );
    return DashboardResponseDto.fromMetrics(metrics);
  }
}
