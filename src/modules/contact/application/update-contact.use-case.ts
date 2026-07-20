import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Contact } from '../domain/contact';
import { ContactType } from '../domain/contact-type.enum';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type {
  ContactRepositoryPort,
  UpdateContactData,
} from '../domain/contact-repository.port';

/** Champs modifiables (tous optionnels — sémantique PATCH). */
export interface UpdateContactInput {
  type?: ContactType;
  companyName?: string;
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
  isActive?: boolean;
}

/**
 * Cas d'utilisation : modifier un contact.
 * Mêmes normalisations que la création, appliquées uniquement aux
 * champs réellement fournis.
 */
@Injectable()
export class UpdateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(
    contactId: string,
    input: UpdateContactInput,
  ): Promise<Contact> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }

    // Copie des champs fournis, puis normalisation de ceux qui en ont
    // besoin. Les champs absents (undefined) ne seront pas écrits en
    // base (filtrés par le repository).
    const changes: UpdateContactData = { ...input };
    if (input.companyName !== undefined) {
      changes.companyName = input.companyName.trim();
    }
    if (input.email !== undefined) {
      changes.email = input.email.trim().toLowerCase();
    }
    if (input.country !== undefined) {
      changes.country = input.country.toUpperCase();
    }

    return this.contactRepository.update(contactId, changes);
  }
}
