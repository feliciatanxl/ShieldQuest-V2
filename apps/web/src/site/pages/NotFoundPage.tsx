import { ErrorView } from './ErrorPage';

/** Unknown addresses: the shared error page for 404. */
export function NotFoundPage() {
  return <ErrorView code={404} />;
}
