import { ApiProperty } from '@nestjs/swagger';

/** Le pipe commercial : devis par étape. */
export class QuotesPipelineDto {
  @ApiProperty({ example: 4 })
  draftCount!: number;

  @ApiProperty({ example: 2 })
  sentCount!: number;

  @ApiProperty({ example: 1 })
  acceptedCount!: number;
}
