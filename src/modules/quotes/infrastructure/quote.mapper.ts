import { Injectable } from '@nestjs/common';
import { Quote } from '../domain/quote';
import { QuoteLine } from '../domain/quote-line';
import { QuoteEntity } from './entities/quote.entity';
import { QuoteLineEntity } from './entities/quote-line.entity';

/** Conversion entités TypeORM -> modèles de domaine. */
@Injectable()
export class QuoteMapper {
  toDomain(entity: QuoteEntity): Quote {
    // Les lignes sont triées par position (ordre d'affichage du devis) ;
    // absentes (listes), le domaine porte un tableau vide.
    const lines = [...(entity.lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => this.lineToDomain(line));

    return new Quote(
      entity.id,
      entity.number,
      entity.customerId,
      // Client joint en lecture ; chaîne vide si la relation n'a pas
      // été chargée (cas du cron, qui ne s'en sert pas).
      entity.customer?.companyName ?? '',
      entity.status,
      entity.validUntil,
      entity.notes,
      entity.totalHT,
      entity.totalVAT,
      entity.totalTTC,
      entity.createdBy,
      entity.createdAt,
      entity.updatedAt,
      lines,
    );
  }

  private lineToDomain(entity: QuoteLineEntity): QuoteLine {
    return new QuoteLine(
      entity.id,
      entity.quoteId,
      entity.productId,
      entity.description,
      entity.quantity,
      entity.unitPrice,
      entity.vatRate,
      entity.discountPercent,
      entity.subtotalHT,
    );
  }
}
