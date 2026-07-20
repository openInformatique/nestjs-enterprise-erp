import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

/** Corps de POST /technical-demo/mail. */
export class SendDemoMailRequestDto {
  @ApiProperty({
    description: "Destinataire de l'e-mail de démonstration.",
    example: 'destinataire@example.com',
  })
  @IsEmail(
    {},
    { message: 'L’adresse e-mail du destinataire n’est pas valide.' },
  )
  @MaxLength(320)
  recipient!: string;
}

/** Réponse de POST /technical-demo/mail. */
export class SendDemoMailResponseDto {
  @ApiProperty({ description: "L'envoi a-t-il abouti ?" })
  delivered!: boolean;

  @ApiProperty({
    description: 'Identifiant du message chez le transporteur.',
    nullable: true,
  })
  messageId!: string | null;
}

/** Réponse de POST /technical-demo/files. */
export class StoredFileResponseDto {
  @ApiProperty({ description: 'Identifiant du fichier (UUID).' })
  identifier!: string;

  @ApiProperty({ example: 'rapport.pdf' })
  originalName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 12345 })
  sizeBytes!: number;

  @ApiProperty({ description: 'Date de dépôt (ISO 8601, UTC).' })
  storedAt!: string;
}
