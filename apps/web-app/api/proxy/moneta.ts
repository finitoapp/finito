import { handleServiceProxyRequest } from "../../src/server/service-proxy.js"

/** The browser's way to MONETA's VIP API, which answers no CORS preflight. */
const handleRequest = (request: Request): Promise<Response> =>
  handleServiceProxyRequest(request, { service: "moneta" })

export const GET = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
