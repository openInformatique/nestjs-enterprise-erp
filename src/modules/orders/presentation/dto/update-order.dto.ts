import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/**
 * Corps de PATCH /orders/:id (DRAFT ou CONFIRMED).
 * OmitType retire `type` : le SENS d'une commande ne change jamais
 * après création (une commande client ne devient pas fournisseur).
 * Si `lines` est fourni : remplacement complet + totaux recalculés.
 */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['type'] as const),
) {}
