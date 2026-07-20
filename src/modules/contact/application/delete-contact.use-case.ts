import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/**
 * Cas d'utilisation : supprimer (logiquement) un contact.
 *
 * Version minimale : la vérification « pas de devis/commandes actifs
 * liés » (hasActiveRelations → 409) sera branchée quand ces modules
 * existeront — la spec elle-même la décrit comme « implémentée après
 * module 05 ». La donnée n'étant jamais détruite (soft-delete), un
 * contact supprimé par erreur reste restaurable.
 */
@Injectable()
export class DeleteContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(contactId: string): Promise<void> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }

    await this.contactRepository.softDelete(contactId);
  }
}
