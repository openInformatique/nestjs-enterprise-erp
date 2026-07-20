import { ApiProperty } from '@nestjs/swagger';
import { Contact } from '../../domain/contact';
import { ContactType } from '../../domain/contact-type.enum';

/**
 * Représentation publique d'un contact.
 * Aucun champ sensible ici : tout le contact est exposable (spec §4.1).
 */
export class ContactResponseDto {
  @ApiProperty({ description: 'Identifiant du contact (UUID).' })
  id!: string;

  @ApiProperty({ enum: ContactType })
  type!: ContactType;

  @ApiProperty({ example: 'Dupont & Fils SARL' })
  companyName!: string;

  @ApiProperty({ nullable: true, example: 'Jean Dupont' })
  contactName!: string | null;

  @ApiProperty({ nullable: true, example: 'contact@dupont-fils.fr' })
  email!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  street!: string | null;

  @ApiProperty({ nullable: true })
  city!: string | null;

  @ApiProperty({ nullable: true })
  postalCode!: string | null;

  @ApiProperty({ example: 'FR' })
  country!: string;

  @ApiProperty({ nullable: true, example: '73282932000074' })
  siret!: string | null;

  @ApiProperty({ nullable: true, example: 'FR40303265045' })
  vatNumber!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'False pour un contact désactivé.' })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  /** Conversion domaine -> DTO. */
  static fromDomain(contact: Contact): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = contact.id;
    dto.type = contact.type;
    dto.companyName = contact.companyName;
    dto.contactName = contact.contactName;
    dto.email = contact.email;
    dto.phone = contact.phone;
    dto.street = contact.street;
    dto.city = contact.city;
    dto.postalCode = contact.postalCode;
    dto.country = contact.country;
    dto.siret = contact.siret;
    dto.vatNumber = contact.vatNumber;
    dto.notes = contact.notes;
    dto.isActive = contact.isActive;
    dto.createdAt = contact.createdAt;
    dto.updatedAt = contact.updatedAt;
    return dto;
  }
}
