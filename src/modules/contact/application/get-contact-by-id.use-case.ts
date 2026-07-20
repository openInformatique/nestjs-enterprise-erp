import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../common/exceptions/app-exceptions';
import { Contact } from '../domain/contact';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type { ContactRepositoryPort } from '../domain/contact-repository.port';

/**
 * Cas d'utilisation : récupérer un contact par son identifiant.
 * Lève RESOURCE_NOT_FOUND si inexistant ou supprimé logiquement.
 */
@Injectable()
export class GetContactByIdUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  async execute(contactId: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new ResourceNotFoundException('Le contact');
    }
    return contact;
  }
}
