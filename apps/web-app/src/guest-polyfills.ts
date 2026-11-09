if (typeof URL.canParse !== "function") {
  URL.canParse = (url, base) => {
    try {
      new URL(url, base)
      return true
    } catch {
      return false
    }
  }
}

if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = <T>() => {
    let resolve: PromiseWithResolvers<T>["resolve"] = () => {}
    let reject: PromiseWithResolvers<T>["reject"] = () => {}
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise
      reject = rejectPromise
    })
    return { promise, resolve, reject }
  }
}
