import QRCode from "qrcode";

/**
 * A QR code, drawn as real SVG rather than an image.
 *
 * The modules are emitted as one path of 1x1 squares on a viewBox measured in
 * modules, so it is resolution-independent: the same element scans off a
 * laptop screen, a tablet held across a counter, and a sheet of A4.
 *
 * `crispEdges` matters more than it looks. Antialiasing a module boundary
 * greys the edge pixels, and a reader thresholding a photograph of a screen
 * can take a grey edge for a module of its own -- so the code either fails to
 * decode or, worse, decodes to something else.
 *
 * Generated at build time: this runs in a server component, and the markup it
 * returns is in the exported HTML with no script behind it.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const count = modules.size;

  let path = "";
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (modules.data[y * count + x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className="h-full w-full"
    >
      <path d={path} fill="#000000" />
    </svg>
  );
}

/**
 * The code on the white plate it needs to be read from.
 *
 * Dark modules on white, always -- never inverted to match the page around
 * it. The spec gives the two colours different meanings, and while most
 * modern readers cope with an inversion, the cheap ones baked into older
 * Android camera apps do not. Whoever scans this is using whatever phone they
 * walked in with, so a code that fails for one in ten of them is worse than
 * one that looks slightly foreign on a dark page.
 *
 * The white padding is the quiet zone. Keeping it out here rather than as a
 * margin inside the viewBox means it stays generous without shrinking the
 * modules themselves.
 */
export function QrPlate({
  value,
  label,
  className = "h-24 w-24",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className="w-fit rounded-plate bg-white p-2">
      <div className={className}>
        <QrCode value={value} label={label} />
      </div>
    </div>
  );
}
