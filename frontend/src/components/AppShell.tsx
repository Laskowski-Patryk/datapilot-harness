import type { ReactNode } from "react";

interface AppShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function AppShell({ left, center, right }: AppShellProps) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-canvas text-ink">
      <div className="grid min-h-screen w-full min-w-0 max-w-full grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_minmax(520px,1fr)_360px]">
        <aside className="min-h-0 w-full min-w-0 max-w-[calc(100vw-2rem)] lg:max-w-none">
          {left}
        </aside>
        <section className="min-h-0 w-full min-w-0 max-w-[calc(100vw-2rem)] lg:max-w-none">
          {center}
        </section>
        <section className="min-h-0 w-full min-w-0 max-w-[calc(100vw-2rem)] lg:max-w-none">
          {right}
        </section>
      </div>
    </div>
  );
}
