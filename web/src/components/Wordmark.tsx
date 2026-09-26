/** The product name as plain text — there is no logo asset, so none is drawn. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`text-base font-semibold tracking-tight ${light ? "text-white" : "text-gray-900"}`}
    >
      Repo Swarm
    </span>
  );
}
