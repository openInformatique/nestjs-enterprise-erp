import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '../domain/contact';
import { ContactType } from '../domain/contact-type.enum';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/** Données de création (déjà validées par le DTO). */
export interface CreateContactInput {
  type: ContactType;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  siret?: string;
  vatNumber?: string;
  notes?: string;
}

/**
 * Cas d'utilisation : créer un contact.
 *
 * Normalisations appliquées ici (et pas dans le DTO : le DTO valide,
 * le use case transforme) :
 *   - e-mail : trim + minuscules, comme partout dans le projet ;
 *   - pays : 'FR' par défaut, forcé en majuscules ;
 *   - « absent » devient null (convention du port).
 *
 * Le format du SIRET (14 chiffres) est garanti par le DTO ; la
 * validation de sa clé (algorithme de Luhn) arrive au niveau min-.
 */
@Injectable()
export class CreateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  execute(input: CreateContactInput): Promise<Contact> {
    return this.contactRepository.create({
      type: input.type,
      companyName: input.companyName.trim(),
      contactName: input.contactName?.trim() ?? null,
      email: input.email ? input.email.trim().toLowerCase() : null,
      phone: input.phone ?? null,
      street: input.street ?? null,
      city: input.city ?? null,
      postalCode: input.postalCode ?? null,
      country: (input.country ?? 'FR').toUpperCase(),
      siret: input.siret ?? null,
      vatNumber: input.vatNumber ?? null,
      notes: input.notes ?? null,
    });
  }
}
