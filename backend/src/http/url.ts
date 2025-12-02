export function safeParseUrl(requestUrl: string | undefined, hostHeader: string | undefined): URL | null {
    if (!requestUrl) {
        return null;
    }

    const host = hostHeader ?? 'localhost';

    try {
        return new URL(requestUrl, `http://${host}`);
    } catch (error) {
        console.error('Failed to parse request URL', error);
        return null;
    }
}
