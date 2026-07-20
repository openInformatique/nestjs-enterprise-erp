import { PartialType } from '@nestjs/swagger';
import { CreateQuoteDto } from './create-quote.dto';

/**
 * Corps de PATCH /quotes/:id (brouillons uniquement).
 * Tout est optionnel ; si `lines` est fourni, les lignes existantes
 * sont INTÉGRALEMENT remplacées et les totaux recalculés.
 */
export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
