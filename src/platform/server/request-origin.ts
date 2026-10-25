/** Honor the explicit deployment origin; otherwise use the actual HTTP host.
 * Next's internal URL can normalize a loopback request to localhost. */
export function requestOrigin(request: Request): string {
  if (process.env.NEUROPLAST_ORIGIN) return new URL(process.env.NEUROPLAST_ORIGIN).origin;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url.origin;
}
