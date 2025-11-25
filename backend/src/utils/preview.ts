import JSZip from 'jszip';

const PREVIEW_CHAPTER_LIMIT = 10;

const META_CONTAINER_PATH = 'META-INF/container.xml';

const extractOpfPath = (containerXml: string): string | null => {
  const match = containerXml.match(/full-path=['"]([^'" >]+)['"]/i);
  return match?.[1] ?? null;
};

const trimSpineToPreview = (opfContent: string, chapterLimit: number): string | null => {
  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/i);
  if (!spineMatch) {
    return null;
  }

  const spineBody = spineMatch[1];
  const itemRefs = spineBody.match(/<itemref[^>]*?>/gi) ?? [];
  if (itemRefs.length === 0) {
    return null;
  }

  const limited = itemRefs.slice(0, chapterLimit).join('\n');
  const updatedSpine = spineMatch[0].replace(spineBody, `\n${limited}\n`);

  return opfContent.replace(spineMatch[0], updatedSpine);
};

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
