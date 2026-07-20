import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { ValidationException } from '../../common/exceptions/app-exceptions';
import { SendDemoMailUseCase } from '../mail/application/send-demo-mail.use-case';
import { GenerateDemoPdfUseCase } from '../pdf/application/generate-demo-pdf.use-case';
import {
  DeleteDemoFileUseCase,
  ReadDemoFileUseCase,
  StoreDemoFileUseCase,
} from '../storage/application/demo-file.use-cases';
import {
  SendDemoMailRequestDto,
  SendDemoMailResponseDto,
  StoredFileResponseDto,
} from './technical-demo.dto';

/**
 * Endpoints de DÉMONSTRATION des briques techniques du socle.
 *
 * - enregistrés uniquement lorsque TECHNICAL_DEMO_ENDPOINTS_ENABLED=true
 *   (voir TechnicalDemoModule et app.module.ts) ;
 * - protégés par le guard JWT global (aucun @Public()) ;
 * - sans aucune logique métier : chaque handler délègue à un cas
 *   d'utilisation de démonstration.
 */
@ApiTags('Démonstration technique')
@ApiBearerAuth()
@Controller('technical-demo')
export class TechnicalDemoController {
  constructor(
    private readonly sendDemoMailUseCase: SendDemoMailUseCase,
    private readonly storeDemoFileUseCase: StoreDemoFileUseCase,
    private readonly readDemoFileUseCase: ReadDemoFileUseCase,
    private readonly deleteDemoFileUseCase: DeleteDemoFileUseCase,
    private readonly generateDemoPdfUseCase: GenerateDemoPdfUseCase,
  ) {}

  @Post('mail')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "[Démo] Envoi d'un e-mail technique",
    description:
      'Utilise le fournisseur configuré (MAIL_DRIVER) : en "development", ' +
      "l'e-mail est journalisé sans envoi réel.",
  })
  @ApiOkResponse({ type: SendDemoMailResponseDto })
  async sendMail(
    @Body() body: SendDemoMailRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SendDemoMailResponseDto> {
    const result = await this.sendDemoMailUseCase.execute(
      body.recipient,
      user.userId,
    );
    return {
      delivered: result.delivered,
      messageId: result.messageId ?? null,
    };
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Fichier à téléverser (champ "file").',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: "[Démo] Dépôt d'un fichier",
    description:
      'Type MIME et taille validés par la configuration de stockage.',
  })
  @ApiCreatedResponse({ type: StoredFileResponseDto })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StoredFileResponseDto> {
    if (!file) {
      throw new ValidationException([
        { field: 'file', message: 'Un fichier est requis (champ "file").' },
      ]);
    }

    const stored = await this.storeDemoFileUseCase.execute(
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer,
      },
      user.userId,
    );

    return {
      identifier: stored.identifier,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      storedAt: stored.storedAt.toISOString(),
    };
  }

  @Get('files/:id')
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: "[Démo] Téléchargement d'un fichier",
    description: 'Réponse binaire en flux, sans enveloppe JSON.',
  })
  @ApiProduces('application/octet-stream')
  async downloadFile(
    @Param('id', new ParseUUIDPipe()) identifier: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { metadata, stream } =
      await this.readDemoFileUseCase.execute(identifier);

    response.setHeader('Content-Type', metadata.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(metadata.originalName)}"`,
    );
    return new StreamableFile(stream);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "[Démo] Suppression d'un fichier" })
  @ApiNoContentResponse({ description: 'Fichier supprimé.' })
  async deleteFile(
    @Param('id', new ParseUUIDPipe()) identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteDemoFileUseCase.execute(identifier, user.userId);
  }

  @Get('pdf')
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: '[Démo] Génération du PDF technique',
    description:
      'Renvoie un PDF téléchargeable (date, utilisateur, request ID, ' +
      'données fictives), sans enveloppe JSON.',
  })
  @ApiProduces('application/pdf')
  async generatePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const pdf = await this.generateDemoPdfUseCase.execute(user.userId);

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="demonstration-technique.pdf"',
    );
    return new StreamableFile(pdf);
  }
}
