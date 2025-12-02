import http from 'node:http';

export function respondWithError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
}

export function respondWithOk(res: http.ServerResponse, paymentId?: string): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
        JSON.stringify({
            ok: true,
            paymentId: paymentId ?? null,
        }),
    );
}
