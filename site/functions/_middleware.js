export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (["/intake", "/intake.html"].includes(url.pathname))
    return new Response(null, {
      status: 303,
      headers: { Location: "/book.html", "Cache-Control": "no-store" },
    });
  const response = await context.next();
  if (
    url.pathname.startsWith("/api/") ||
    ["/book", "/book.html", "/account", "/account.html"].includes(url.pathname)
  ) {
    const secured = new Response(response.body, response);
    secured.headers.set("Cache-Control", "no-store");
    secured.headers.set("Referrer-Policy", "same-origin");
    return secured;
  }
  return response;
}
