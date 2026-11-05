/**
 * The WebSocket under Qerko's POS interface (`qerko-rpc.ts`), as a service dep
 * like `NostrDep`, so tests drive the protocol through a fake socket. The
 * implementation is the global `WebSocket`, which both the browser and React
 * Native provide.
 */

export interface QerkoSocketHandlers {
  readonly onOpen: () => void
  readonly onMessage: (text: string) => void
  /** Called once, whoever closed the socket; a failed connect closes it too. */
  readonly onClose: (code: number, reason: string) => void
}

export interface QerkoSocketConnection {
  readonly send: (text: string) => void
  readonly close: () => void
}

export interface QerkoSocketDep {
  readonly qerkoSocket: {
    readonly connect: (
      url: string,
      handlers: QerkoSocketHandlers
    ) => QerkoSocketConnection
  }
}

export const createQerkoSocketDep = (): QerkoSocketDep => ({
  qerkoSocket: {
    connect: (url, handlers) => {
      const socket = new WebSocket(url)
      socket.onopen = () => handlers.onOpen()
      socket.onmessage = (event) => {
        if (typeof event.data === "string") handlers.onMessage(event.data)
      }
      // An error is always followed by `close`, which is where it is handled.
      socket.onclose = (event) => handlers.onClose(event.code, event.reason)
      return {
        send: (text) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(text)
        },
        // A browser lets a page close only with 1000 or a 3000–4999 code.
        close: () => socket.close(1000),
      }
    },
  },
})
