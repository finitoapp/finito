import { handleServiceProxyRequest } from "../../src/server/service-proxy.js"

/** The browser's way to Fio's API, which answers no CORS preflight. */
const handleRequest = (request: Request): Promise<Response> =>
  handleServiceProxyRequest(request, { service: "fio" })

export const GET = handleRequest
export const OPTIONS = handleRequest

export default {
  fetch: handleRequest,
}
