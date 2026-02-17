/**
 * Global constants
 */

// File upload limits
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_COUNT = 20;

// Supported input formats
export const INPUT_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
];
export const OUTPUT_FORMATS = ["jpg", "png", "webp", "pdf"] as const;

// MIME type mapping
export const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

// Compression presets
export const COMPRESSION_PRESETS = {
  extreme: 30,
  recommended: 60,
  light: 80,
  lossless: 95,
} as const;

// Aspect ratio presets
export const RATIO_PRESETS = [
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3", w: 4, h: 3 },
  { label: "16:9", w: 16, h: 9 },
  { label: "3:2", w: 3, h: 2 },
  { label: "9:16", w: 9, h: 16 },
] as const;

// Performance targets
export const PERFORMANCE = {
  maxProcessingTime: 3000, // 3 seconds for 5MB
  debounceDelay: 300, // slider release delay
} as const;
