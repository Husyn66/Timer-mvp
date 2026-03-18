'use client';

type RetryBlockProps = {
  title?: string;
  description?: string;
  onRetry: () => void;
  isRetrying?: boolean;
};

export default function RetryBlock({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
  isRetrying = false,
}: RetryBlockProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 text-base font-semibold text-white">{title}</div>
      <div className="mb-4 text-sm text-zinc-400">{description}</div>

      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}