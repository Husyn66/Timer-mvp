export async function fetchWithRetry<T>(
  fetcher: () => Promise<T>,
  options?: {
    retries?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const retries = options?.retries ?? 2;
  const delayMs = options?.delayMs ?? 800;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      const canRetry = attempt < retries && shouldRetry(error);
      if (!canRetry) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1))
      );
    }
  }

  throw lastError;
}