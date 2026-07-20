import { PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * Corps de PATCH /invoices/:id (brouillons uniquement).
 * Si `lines` est fourni : remplacement complet + totaux recalculés.
 */
export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}
