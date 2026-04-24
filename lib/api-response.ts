/** Consistent JSON response helpers used by all route handlers. */

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

export function paginated<T>(data: T[], total: number, page: number, limit: number): Response {
  return Response.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export function created<T>(data: T): Response {
  return Response.json({ data }, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error"): Response {
  return Response.json({ error: message }, { status: 500 });
}
