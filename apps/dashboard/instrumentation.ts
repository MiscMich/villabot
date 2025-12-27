// This file is used to initialize Sentry on the server side.
// It's automatically loaded by Next.js instrumentation system.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  error: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) => {
  // Import Sentry dynamically to avoid issues with instrumentation
  const Sentry = await import('@sentry/nextjs');

  Sentry.withScope((scope) => {
    // Add request context as tags
    scope.setTag('request.path', request.path);
    scope.setTag('request.method', request.method);
    scope.setTag('router.kind', context.routerKind);
    scope.setTag('router.path', context.routePath);
    scope.setTag('router.type', context.routeType);

    // Add extra context
    scope.setExtra('renderSource', context.renderSource);
    scope.setExtra('revalidateReason', context.revalidateReason);

    Sentry.captureException(error);
  });
};
