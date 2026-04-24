import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** Extract and verify JWT from an HTTP request (cookie OR Bearer header). */
export function getAuthUser(request: Request): JwtPayload | null {
  // 1. Try Authorization header (for mobile apps)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }

  // 2. Try HTTP-only cookie (for web)
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (match) {
    return verifyToken(match[1]);
  }

  return null;
}

/** Build a Set-Cookie string for login response. */
export function makeAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${secure}`;
}

/** Build a cookie that clears the session. */
export function clearAuthCookie(): string {
  return "token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}
