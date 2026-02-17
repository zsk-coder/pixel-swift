/**
 * Format detection utility
 *
 * Detects image format by reading file magic bytes,
 * which is more reliable than file extension or MIME type.
 */

const SIGNATURES: Array<{ format: string; bytes: number[]; offset?: number }> =
  [
    { format: "jpg", bytes: [0xff, 0xd8, 0xff] },
    { format: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
    { format: "webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // "RIFF" + "WEBP" at offset 8
    { format: "bmp", bytes: [0x42, 0x4d] },
    { format: "tiff", bytes: [0x49, 0x49, 0x2a, 0x00] }, // Little-endian
    { format: "tiff", bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // Big-endian
  ];

export async function detectFormat(file: File): Promise<string> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check WebP ("RIFF" + "WEBP")
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
    const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (riff === "RIFF" && webp === "WEBP") return "webp";
  }

  // Check other signatures
  for (const sig of SIGNATURES) {
    if (sig.format === "webp") continue; // Already handled
    const offset = sig.offset || 0;
    const match = sig.bytes.every((b, i) => bytes[offset + i] === b);
    if (match) return sig.format;
  }

  // Fallback to extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext || "unknown";
}

export function isFormatSupported(format: string): boolean {
  const supported = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "bmp",
    "tif",
    "tiff",
  ];
  return supported.includes(format.toLowerCase());
}
