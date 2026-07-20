import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CreateContactUseCase } from './application/create-contact.use-case';
import { DeleteContactUseCase } from './application/delete-contact.use-case';
import { ExportContactsUseCase } from './application/export-contacts.use-case';
import { GetContactByIdUseCase } from './application/get-contact-by-id.use-case';
import { ListContactsUseCase } from './application/list-contacts.use-case';
import { UpdateContactUseCase } from './application/update-contact.use-case';
import { CONTACT_REPOSITORY } from './domain/contact-repository.port';
import { ContactMapper } from './infrastructure/contact.mapper';
import { ContactEntity } from './infrastructure/entities/contact.entity';
import { TypeOrmContactRepository } from './infrastructure/typeorm-contact.repository';
import { ContactsController } from './presentation/contacts.controller';

/**
 * Module des contacts (clients & fournisseurs).
 *
 * Le port CONTACT_REPOSITORY et GetContactByIdUseCase sont exportés :
 * les modules devis (05), commandes (06) et factures (07) en auront
 * besoin pour vérifier leurs contacts.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ContactEntity]), AuditModule],
  controllers: [ContactsController],
  providers: [
    ContactMapper,
    ListContactsUseCase,
    GetContactByIdUseCase,
    CreateContactUseCase,
    UpdateContactUseCase,
    DeleteContactUseCase,
    ExportContactsUseCase,
    {
      provide: CONTACT_REPOSITORY,
      useClass: TypeOrmContactRepository,
    },
  ],
  exports: [CONTACT_REPOSITORY, GetContactByIdUseCase],
})
export class ContactsModule {}
