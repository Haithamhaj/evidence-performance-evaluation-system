import { AppError } from "@evaluation/contracts";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AccessTokenValidationConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly jwks: import("jose").JWTVerifyGetKey;
}

export function remoteAccessTokenValidationConfig(
  issuer: string,
  audience: string,
): AccessTokenValidationConfig {
  const normalizedIssuer = issuer.replace(/\/$/u, "");
  return {
    issuer: normalizedIssuer,
    audience,
    jwks: createRemoteJWKSet(new URL(`${normalizedIssuer}/protocol/openid-connect/certs`)),
  };
}

export async function validateAccessToken(
  token: string,
  config: AccessTokenValidationConfig,
): Promise<import("./principal.js").ValidatedOidcPrincipal> {
  try {
    const options: import("jose").JWTVerifyOptions = {
      algorithms: ["RS256"],
      audience: config.audience,
      issuer: config.issuer,
    };
    const { payload } = await jwtVerify(token, config.jwks, options);

    if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new Error("missing sub");
    if (typeof payload.email !== "string" || payload.email.length === 0) {
      throw new Error("missing email");
    }
    if (payload.email_verified !== true) throw new Error("unverified email");

    return {
      oidcSubject: payload.sub,
      email: payload.email,
      issuer: config.issuer,
    };
  } catch {
    throw new AppError("AUTH_INVALID_TOKEN", "errors.auth.invalidToken", 401);
  }
}
