import { Injectable } from '@nestjs/common';
import { Contact } from '../domain/contact';
import { ContactEntity } from './entities/contact.entity';

/**
 * Conversion entité TypeORM <-> modèle de domaine.
 * Le domaine ne voit jamais l'entité TypeORM.
 */
@Injectable()
export class ContactMapper {
  toDomain(entity: ContactEntity): Contact {
    return new Contact(
      entity.id,
      entity.type,
      entity.companyName,
      entity.contactName,
      entity.email,
      entity.phone,
      entity.street,
      entity.city,
      entity.postalCode,
      entity.country,
      entity.siret,
      entity.vatNumber,
      entity.notes,
      entity.isActive,
      entity.createdAt,
      entity.updatedAt,
      entity.deletedAt,
    );
  }
}
