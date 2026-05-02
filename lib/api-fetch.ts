/**
 * Thin wrapper around fetch that redirects to /login on 401.
 * Use this instead of bare fetch() in all client components.
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Session expired. Redirecting to login.");
  }
  return res;
}
