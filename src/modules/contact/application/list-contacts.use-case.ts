import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/pagination/paginated-result';
import { Contact } from '../domain/contact';
import { CONTACT_REPOSITORY } from '../domain/contact-repository.port';
import type {
  ContactRepositoryPort,
  ListContactsQuery,
} from '../domain/contact-repository.port';

/** Cas d'utilisation : lister les contacts (pagination + filtres). */
@Injectable()
export class ListContactsUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
  ) {}

  execute(query: ListContactsQuery): Promise<PaginatedResult<Contact>> {
    return this.contactRepository.findAll(query);
  }
}
