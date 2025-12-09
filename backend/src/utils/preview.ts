import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const PREVIEW_CHAPTER_LIMIT = 5;

const META_CONTAINER_PATH = 'META-INF/container.xml';

const extractOpfPath = (containerXml: string): string | null => {
  const match = containerXml.match(/full-path=['"]([^'" >]+)['"]/i);
  return match?.[1] ?? null;
};

export function trimSpineToPreview(opfContent: string, chapterLimit: number): string | null {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
    });

    let opf: any;
    try {
        opf = parser.parse(opfContent);
    } catch {
        return null;
    }

    const spine = opf?.package?.spine?.itemref;
    if (!spine) return null;

    // spine может быть массивом или одним объектом
    const spineArray = Array.isArray(spine) ? spine : [spine];

    const previewSpine = spineArray.slice(0, chapterLimit);

    opf.package.spine.itemref = Array.isArray(spine) ? previewSpine : previewSpine[0];

    const newXml = builder.build(opf);
    return newXml;
}

export async function buildEpubPreview(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const containerFile = zip.file(META_CONTAINER_PATH);
  if (!containerFile) {
    return buffer;
  }

  const containerXml = await containerFile.async('string');
  const opfPath = extractOpfPath(containerXml);
  if (!opfPath) {
    return buffer;
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    return buffer;
  }

  const opfContent = await opfFile.async('string');
  const trimmed = trimSpineToPreview(opfContent, PREVIEW_CHAPTER_LIMIT);
  if (!trimmed) {
    return buffer;
  }

  zip.file(opfPath, trimmed);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export function buildAudioPreview(buffer: Buffer): Buffer {
  const maxBytes = 1_500_000; // ~1.5MB audio preview
  if (buffer.byteLength <= maxBytes) {
    return buffer;
  }

  return buffer.subarray(0, maxBytes);
}
