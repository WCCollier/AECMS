import { Injectable, Logger } from '@nestjs/common';
import { PersonalizationOptionsDto, FileFormat } from './dto/digital-product.dto';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  async personalize(
    fileBuffer: Buffer,
    format: FileFormat,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    if (!options.customerName && !options.orderNumber && !options.purchaseDate) {
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

  private async personalizeEpub(
    fileBuffer: Buffer,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    try {
      const zip = new AdmZip(fileBuffer);

      // Find OPF file via META-INF/container.xml
      const containerEntry = zip.getEntry('META-INF/container.xml');
      if (!containerEntry) {
        this.logger.warn('EPUB: META-INF/container.xml not found; returning original');
        return fileBuffer;
      }

      const containerXml = containerEntry.getData().toString('utf-8');
      const parser = new DOMParser();
      const containerDoc = parser.parseFromString(containerXml, 'text/xml');
      const rootfileEls = containerDoc.getElementsByTagName('rootfile');
      const opfPath = rootfileEls.length > 0 ? rootfileEls[0].getAttribute('full-path') : null;

      if (!opfPath) {
        this.logger.warn('EPUB: rootfile path not found; returning original');
        return fileBuffer;
      }

      const opfEntry = zip.getEntry(opfPath);
      if (!opfEntry) {
        this.logger.warn(`EPUB: OPF file ${opfPath} not found; returning original`);
        return fileBuffer;
      }

      const opfXml = opfEntry.getData().toString('utf-8');
      const doc = parser.parseFromString(opfXml, 'text/xml');

      // Derive base path for the OPF
      const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
      const personalizationRelPath = 'aecms-personalization.xhtml';
      const personalizationZipPath = opfDir + personalizationRelPath;

      // Build personalization XHTML
      const xhtml = this.generatePersonalizationHtml(options);
      zip.addFile(personalizationZipPath, Buffer.from(xhtml, 'utf-8'));

      // Add to manifest
      const manifests = doc.getElementsByTagName('manifest');
      if (manifests.length > 0) {
        const manifest = manifests[0];
        const itemEl = doc.createElement('item');
        itemEl.setAttribute('id', 'aecms-personalization');
        itemEl.setAttribute('href', personalizationRelPath);
        itemEl.setAttribute('media-type', 'application/xhtml+xml');
        manifest.insertBefore(itemEl, manifest.firstChild);
      }

      // Prepend to spine
      const spines = doc.getElementsByTagName('spine');
      if (spines.length > 0) {
        const spine = spines[0];
        const itemrefEl = doc.createElement('itemref');
        itemrefEl.setAttribute('idref', 'aecms-personalization');
        spine.insertBefore(itemrefEl, spine.firstChild);
      }

      // Serialize OPF back
      const serializer = new XMLSerializer();
      const updatedOpf = serializer.serializeToString(doc);
      zip.updateFile(opfPath, Buffer.from(updatedOpf, 'utf-8'));

      this.logger.log(
        `EPUB personalized: ${options.customerName || 'N/A'}, Order: ${options.orderNumber || 'N/A'}`,
      );

      return zip.toBuffer();
    } catch (err) {
      this.logger.error('EPUB personalization failed; returning original', err);
      return fileBuffer;
    }
  }

  private async personalizePdf(
    fileBuffer: Buffer,
    options: PersonalizationOptionsDto,
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Insert a new first page
      const [width, height] = [612, 792]; // US Letter
      const page = pdfDoc.insertPage(0, [width, height]);

      const gray = rgb(0.4, 0.4, 0.4);
      const dark = rgb(0.1, 0.1, 0.1);
      const accent = rgb(0.2, 0.4, 0.8);

      // Thin border frame
      page.drawRectangle({
        x: 48,
        y: 48,
        width: width - 96,
        height: height - 96,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });

      let y = height / 2 + 80;

      page.drawText('Licensed Copy', {
        x: 72,
        y,
        size: 22,
        font: helveticaBold,
        color: dark,
      });

      y -= 8;
      page.drawLine({
        start: { x: 72, y },
        end: { x: width - 72, y },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.85),
      });

      y -= 28;
      page.drawText('This copy is licensed to:', {
        x: 72,
        y,
        size: 11,
        font: helvetica,
        color: gray,
      });

      if (options.customerName) {
        y -= 26;
        page.drawText(options.customerName, {
          x: 72,
          y,
          size: 15,
          font: helveticaBold,
          color: dark,
        });
      }

      if (options.orderNumber) {
        y -= 30;
        page.drawText('Order:', {
          x: 72,
          y,
          size: 10,
          font: helvetica,
          color: gray,
        });
        page.drawText(options.orderNumber, {
          x: 114,
          y,
          size: 10,
          font: helvetica,
          color: accent,
        });
      }

      const date = options.purchaseDate || new Date().toLocaleDateString();
      y -= 20;
      page.drawText('Purchase Date:', {
        x: 72,
        y,
        size: 10,
        font: helvetica,
        color: gray,
      });
      page.drawText(date, {
        x: 154,
        y,
        size: 10,
        font: helvetica,
        color: dark,
      });

      y -= 40;
      page.drawText(
        'Unauthorized reproduction or distribution is prohibited.',
        {
          x: 72,
          y,
          size: 9,
          font: helvetica,
          color: rgb(0.6, 0.6, 0.6),
        },
      );

      this.logger.log(
        `PDF personalized: ${options.customerName || 'N/A'}, Order: ${options.orderNumber || 'N/A'}`,
      );

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (err) {
      this.logger.error('PDF personalization failed; returning original', err);
      return fileBuffer;
    }
  }

  generatePersonalizationHtml(options: PersonalizationOptionsDto): string {
    const date = options.purchaseDate || new Date().toLocaleDateString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Licensed Copy</title>
  <style type="text/css">
    body { margin: 0; padding: 0; font-family: Georgia, "Times New Roman", serif; background: #fff; }
    .wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2em; }
    .card { border: 1px solid #ddd; padding: 2.5em 3em; max-width: 420px; text-align: center; }
    h1 { font-size: 1.3em; color: #111; margin: 0 0 0.8em; letter-spacing: 0.03em; }
    hr { border: none; border-top: 1px solid #eee; margin: 0.8em 0; }
    .label { font-size: 0.8em; color: #888; margin: 0.4em 0 0.1em; }
    .value { font-size: 1.05em; color: #222; margin: 0 0 0.6em; font-weight: bold; }
    .small { font-size: 0.75em; color: #aaa; margin-top: 1.5em; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Licensed Copy</h1>
      <hr />
      <p class="label">This copy is licensed to:</p>
      ${options.customerName ? `<p class="value">${this.escapeHtml(options.customerName)}</p>` : ''}
      ${options.orderNumber ? `<p class="label">Order <span class="value" style="font-size:0.95em">${this.escapeHtml(options.orderNumber)}</span></p>` : ''}
      <p class="label">Purchase Date: ${this.escapeHtml(date)}</p>
      <p class="small">Unauthorized reproduction or distribution is prohibited.</p>
    </div>
  </div>
</body>
</html>`;
  }

  generatePersonalizationText(options: PersonalizationOptionsDto): string {
    const date = options.purchaseDate || new Date().toLocaleDateString();
    const lines: string[] = ['This copy is licensed to:', ''];
    if (options.customerName) { lines.push(options.customerName); lines.push(''); }
    if (options.orderNumber) { lines.push(`Order: ${options.orderNumber}`); }
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
