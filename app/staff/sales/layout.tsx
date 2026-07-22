// Staff routes have no sidebar or admin layout - just raw children
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}