export function NeuroplastLogo({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 96 64" fill="none" aria-hidden="true" className={className}>
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 10 32 32 10 54M32 32h32M86 10 64 32l22 22M20 20V10M20 44v10M76 20V10M76 44v10" />
    </g><g fill="currentColor"><circle cx="32" cy="32" r="5"/><circle cx="64" cy="32" r="5"/>
      <circle cx="10" cy="10" r="2.5"/><circle cx="10" cy="54" r="2.5"/><circle cx="86" cy="10" r="2.5"/><circle cx="86" cy="54" r="2.5"/>
    </g></svg>;
}
