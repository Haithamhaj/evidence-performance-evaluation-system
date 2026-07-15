// COMPAT(openid-client@6.8.4): this runtime bridge pairs with the narrow declaration beside it.
// Remove both adapter files on the next openid-client upgrade once a direct import passes the
// Web TypeScript 7 build with exactOptionalPropertyTypes and the real Keycloak integration suite.
export {
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  discovery,
  None,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";
