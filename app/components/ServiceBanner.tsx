'use client';

import { useOnlineStatus } from '../hooks/useOnlineStatus';

type ServiceBannerProps = {
  hasServerProblem?: boolean;
};

export default function ServiceBanner({
  hasServerProblem = false,
}: ServiceBannerProps) {
  const isOnline = useOnlineStatus();

  if (isOnline && !hasServerProblem) {
    return null;
  }

  const message = !isOnline
    ? 'No internet connection. Some features are temporarily unavailable.'
    : 'Service is unstable right now. Please retry in a moment.';

  return (
    <div className="w-full border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
      {message}
    </div>
  );
}