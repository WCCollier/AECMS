import { Injectable, Logger } from '@nestjs/common';
import { PersonalizationOptionsDto, FileFormat } from './dto/digital-product.dto';

/**
 * Personalization Service
 *
 * Handles personalization of digital files (EPUB, PDF) with customer information.
 * Uses page insert method rather than watermarks or DRM.
 *
 * For EPUB: Inserts a personalization page after the title page
 * For PDF: Adds a personalization page at the beginning
 */
@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  /**
   * Personalize a digital file with customer information
   * @param fileBuffer - Original file buffer
   * @param format - File format (epub, pdf)
   * @param options - Personalization options
   * @returns Personalized file buffer
   */
  async personalize(
    fileBuffer: Buffer,
    format: FileFormat,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    if (!options.customerName && !options.orderNumber && !options.purchaseDate) {
      // No personalization needed
      return fileBuffer;
    }

    switch (format) {
      case FileFormat.EPUB:
        return this.personalizeEpub(fileBuffer, options);
      case FileFormat.PDF:
        return this.personalizePdf(fileBuffer, options);
      default:
        this.logger.warn(`Unsupported format for personalization: ${format}`);
        return fileBuffer;
    }
  }

  /**
   * Personalize EPUB file
   * Note: Full EPUB manipulation requires a library like epub or jszip
   * For now, this is a placeholder that returns the original
   * TODO: Implement EPUB personalization with proper library
   */
  private async personalizeEpub(
    fileBuffer: Buffer,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    this.logger.debug('Personalizing EPUB file', { options });

    // EPUB personalization would involve:
    // 1. Unzipping the EPUB (it's a ZIP file)
    // 2. Parsing the content.opf to find the spine
    // 3. Creating a new XHTML file with personalization content
    // 4. Adding it to the manifest and spine
    // 5. Re-zipping the EPUB

    // For MVP, we log the intent and return original
    // Full implementation requires jszip and careful EPUB structure handling
    this.logger.log(
      `EPUB personalization requested: ${options.customerName || 'N/A'}, Order: ${options.orderNumber || 'N/A'}`,
    );

    return fileBuffer;
  }

  /**
   * Personalize PDF file
   * Note: Full PDF manipulation requires a library like pdf-lib
   * For now, this is a placeholder that returns the original
   * TODO: Implement PDF personalization with proper library
   */
  private async personalizePdf(
    fileBuffer: Buffer,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    this.logger.debug('Personalizing PDF file', { options });

    // PDF personalization would involve:
    // 1. Loading the PDF with pdf-lib
    // 2. Creating a new page with personalization content
    // 3. Inserting it at the beginning
    // 4. Saving the modified PDF

    // For MVP, we log the intent and return original
    // Full implementation requires pdf-lib
    this.logger.log(
      `PDF personalization requested: ${options.customerName || 'N/A'}, Order: ${options.orderNumber || 'N/A'}`,
    );

    return fileBuffer;
  }

  /**
   * Generate personalization page content (HTML)
   * Used for EPUB personalization
   */
  generatePersonalizationHtml(options: PersonalizationOptionsDto): string {
    const date = options.purchaseDate || new Date().toLocaleDateString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Personalization</title>
  <style>
    body { text-align: center; padding: 2em; font-family: serif; }
    .personalization { margin-top: 4em; padding: 2em; border: 1px solid #ccc; }
    .label { color: #666; font-size: 0.9em; }
    .value { font-size: 1.1em; margin-bottom: 1em; }
  </style>
</head>
<body>
  <div class="personalization">
    <p class="label">This copy is licensed to:</p>
    ${options.customerName ? `<p class="value"><strong>${this.escapeHtml(options.customerName)}</strong></p>` : ''}
    ${options.orderNumber ? `<p class="label">Order: ${this.escapeHtml(options.orderNumber)}</p>` : ''}
    <p class="label">Purchase Date: ${this.escapeHtml(date)}</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate personalization text (for PDF)
   */
  generatePersonalizationText(options: PersonalizationOptionsDto): string {
    const date = options.purchaseDate || new Date().toLocaleDateString();
    const lines: string[] = [
      'This copy is licensed to:',
      '',
    ];

    if (options.customerName) {
      lines.push(options.customerName);
      lines.push('');
    }

    if (options.orderNumber) {
      lines.push(`Order: ${options.orderNumber}`);
    }

    lines.push(`Purchase Date: ${date}`);

    return lines.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
