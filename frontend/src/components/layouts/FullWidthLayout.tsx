import { ReactNode } from "react";

interface FullWidthLayoutProps {
  children: ReactNode;
}

export function FullWidthLayout({ children }: FullWidthLayoutProps) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}