import {
  createAuthServer,
  handleAuthProxyRequest,
  extractNeonAuthCookies,
  serializeSetCookie,
  resolveNeonAuthLogging,
} from "@neondatabase/auth/server";
export function createAuth(env, request) {
  if (!env.NEON_AUTH_BASE_URL || !env.NEON_AUTH_COOKIE_SECRET)
    throw new Error("Sign-in not configured");
  const cookies = [];
  const config = {
    baseUrl: env.NEON_AUTH_BASE_URL,
    cookieSecret: env.NEON_AUTH_COOKIE_SECRET,
    sessionDataTtl: 60,
    sameSite: "lax",
    log: resolveNeonAuthLogging({ logLevel: "silent" }),
  };
  const server = createAuthServer({
    ...config,
    context: () => ({
      getCookies: () =>
        extractNeonAuthCookies(request.headers.get("cookie") || ""),
      setCookie: (name, value, options) =>
        cookies.push(serializeSetCookie({ name, value, ...options })),
      getHeader: (name) => request.headers.get(name),
      getOrigin: () => env.APP_ORIGIN,
      getFramework: () => "cloudflare-pages",
    }),
  });
  return {
    api: {
      getSession: async () => {
        const result = await server.getSession({
          query: { disableCookieCache: "true" },
        });
        if (result.error) throw new Error("Session verification unavailable");
        return result.data;
      },
    },
    handler: (req) =>
      handleAuthProxyRequest({
        ...config,
        request: req,
        path: new URL(req.url).pathname.replace(/^\/api\/auth\//, ""),
      }),
    finish: (response) => {
      const result = new Response(response.body, response);
      for (const cookie of cookies) result.headers.append("Set-Cookie", cookie);
      return result;
    },
  };
}
