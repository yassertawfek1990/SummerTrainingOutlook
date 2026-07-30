export default function Logo({ className = "h-10" }: { className?: string }) {
  return (
    // Plain <img> rather than next/image — the logo is hosted on an external
    // domain (unitedpharmacy.sa), and next/image would need that domain
    // explicitly allow-listed in next.config.js to optimize it. A plain tag
    // avoids that extra config for a single static logo.
    <img
      src="https://imagenew.unitedpharmacy.sa/live/media/logo/stores/2/new-header-logo.webp"
      alt="United Pharmacy"
      className={className}
    />
  );
}
