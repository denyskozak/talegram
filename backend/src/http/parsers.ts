import http from 'node:http';
import { Buffer } from 'node:buffer';

export type ParsedFormFieldMap = Record<string, string>;

export type ParsedFormFile = {
    filename: string;
    mimeType?: string;
    data: Buffer;
};

export type ParsedFormFileMap = Record<string, ParsedFormFile>;

export async function parseJsonRequestBody<T>(req: http.IncomingMessage): Promise<T> {
    const body = await readRequestBody(req);
    if (body.byteLength === 0) {
        return {} as T;
    }

    try {
        return JSON.parse(body.toString('utf-8')) as T;
    } catch (error) {
        console.error('Failed to parse JSON body', error);
        throw new Error('Invalid JSON payload');
    }
}

export function parseHashtagsField(rawValue: string | undefined): string[] {
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === 'string').map((item) => item.trim());
        }
    } catch (error) {
        // Fallback to comma-separated parsing if JSON decoding fails
        return rawValue
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    return [];
}

export function isMultipartForm(req: http.IncomingMessage): boolean {
    const contentType = req.headers['content-type'];
    return typeof contentType === 'string' && contentType.startsWith('multipart/form-data');
}

export async function parseMultipartForm(
    req: http.IncomingMessage,
): Promise<{ fields: ParsedFormFieldMap; files: ParsedFormFileMap }> {
    const boundary = extractBoundary(req.headers['content-type']);
    if (!boundary) {
        throw new Error('Multipart boundary not found in content-type header');
    }

    const body = await readRequestBody(req);
    return parseMultipartBody(body, boundary);
}

function extractBoundary(contentTypeHeader: string | undefined): string | null {
    if (!contentTypeHeader) {
        return null;
    }

    const boundaryPrefix = 'boundary=';
    const index = contentTypeHeader.indexOf(boundaryPrefix);
    if (index === -1) {
        return null;
    }

    let boundary = contentTypeHeader.slice(index + boundaryPrefix.length);
    if (boundary.startsWith('"') && boundary.endsWith('"')) {
        boundary = boundary.slice(1, -1);
    }

    // Remove any trailing parameters
    const semicolonIndex = boundary.indexOf(';');
    if (semicolonIndex !== -1) {
        boundary = boundary.slice(0, semicolonIndex);
    }

    return boundary.trim();
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        req.on('data', (chunk) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
}

function parseMultipartBody(
    body: Buffer,
    boundary: string,
): { fields: ParsedFormFieldMap; files: ParsedFormFileMap } {
    const delimiter = Buffer.from(`--${boundary}`);
    const fields: ParsedFormFieldMap = {};
    const files: ParsedFormFileMap = {};
    const headerSeparator = Buffer.from('\r\n\r\n');
    const lineBreak = Buffer.from('\r\n');

    let searchStart = 0;

    while (searchStart < body.length) {
        const boundaryIndex = body.indexOf(delimiter, searchStart);
        if (boundaryIndex === -1) {
            break;
        }

        let partStart = boundaryIndex + delimiter.length;

        // Final boundary is marked with two trailing dashes
        if (partStart + 1 < body.length && body[partStart] === 45 && body[partStart + 1] === 45) {
            break;
        }

        // Skip the required CRLF after the boundary
        if (body[partStart] === 13 && body[partStart + 1] === 10) {
            partStart += 2;
        }

        const headerEndIndex = body.indexOf(headerSeparator, partStart);
        if (headerEndIndex === -1) {
            break;
        }

        const headerBytes = body.slice(partStart, headerEndIndex);
        const headers = parseHeaders(headerBytes.toString('utf-8'));

        const contentStart = headerEndIndex + headerSeparator.length;
        const nextBoundaryIndex = body.indexOf(delimiter, contentStart);
        if (nextBoundaryIndex === -1) {
            break;
        }

        let contentEnd = nextBoundaryIndex;
        if (
            nextBoundaryIndex >= 2 &&
            body[nextBoundaryIndex - 2] === lineBreak[0] &&
            body[nextBoundaryIndex - 1] === lineBreak[1]
        ) {
            contentEnd = nextBoundaryIndex - lineBreak.length;
        }

        const content = body.slice(contentStart, contentEnd);

        const disposition = headers['content-disposition'];
        if (disposition) {
            const { name, filename } = parseContentDisposition(disposition);
            if (name) {
                if (filename) {
                    files[name] = {
                        filename,
                        mimeType: headers['content-type'],
                        data: content,
                    };
                } else {
                    fields[name] = content.toString('utf-8');
                }
            }
        }

        searchStart = nextBoundaryIndex;
    }

    return { fields, files };
}

function parseHeaders(rawHeaders: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = rawHeaders.split('\r\n');

    for (const line of lines) {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        headers[key] = value;
    }

    return headers;
}

function parseContentDisposition(
    disposition: string,
): { name: string | null; filename: string | null } {
    const parts = disposition.split(';').map((part) => part.trim());
    let name: string | null = null;
    let filename: string | null = null;

    for (const part of parts) {
        if (part.toLowerCase() === 'form-data') {
            continue;
        }

        const equalsIndex = part.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }

        const key = part.slice(0, equalsIndex).trim().toLowerCase();
        let value = part.slice(equalsIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }

        if (key === 'name') {
            name = value;
        } else if (key === 'filename') {
            filename = value;
        }
    }

    return { name, filename };
}
