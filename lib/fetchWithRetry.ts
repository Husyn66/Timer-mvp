export type RetryOptions = {
  retries?: number
  delayMs?: number
  maxDelayMs?: number
  signal?: AbortSignal
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'))
      return
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timeout)
      cleanup()
      reject(new DOMException('Request aborted', 'AbortError'))
    }

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function defaultShouldRetry(error: unknown): boolean {
  if (isAbortError(error)) {
    return false
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    const status = (error as { status: number }).status

    // Retry only for rate limiting and server-side failures
    return status === 429 || status >= 500
  }

  // For generic network/runtime errors where no status exists,
  // allow retry by default.
  return true
}

export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 2
  const delayMs = options.delayMs ?? 800
  const maxDelayMs = options.maxDelayMs ?? 5000
  const signal = options.signal
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }

    try {
      return await fetcher()
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }

      const isLastAttempt = attempt >= retries
      const retryAllowed = shouldRetry(error, attempt)

      if (isLastAttempt || !retryAllowed) {
        throw error
      }

      const baseDelay = Math.min(delayMs * 2 ** attempt, maxDelayMs)
      const jitter = Math.floor(Math.random() * 200)
      const waitTime = baseDelay + jitter

      await sleep(waitTime, signal)
    }
  }

  throw new Error('fetchWithRetry: unreachable state')
}