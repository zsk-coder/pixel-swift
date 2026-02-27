declare module "@jsquash/jpeg/encode" {
  interface EncodeOptions {
    quality?: number;
    baseline?: boolean;
    arithmetic?: boolean;
    progressive?: boolean;
    optimize_coding?: boolean;
    smoothing?: number;
    color_space?: number;
    quant_table?: number;
    trellis_multipass?: boolean;
    trellis_opt_zero?: boolean;
    trellis_opt_table?: boolean;
    trellis_loops?: number;
    auto_subsample?: boolean;
    chroma_subsample?: number;
    separate_chroma_quality?: boolean;
    chroma_quality?: number;
  }

  export default function encode(
    data: ImageData,
    options?: EncodeOptions,
  ): Promise<ArrayBuffer>;
}

declare module "@jsquash/jpeg/decode" {
  interface DecodeOptions {
    preserveOrientation?: boolean;
  }

  export default function decode(
    data: ArrayBuffer,
    options?: DecodeOptions,
  ): Promise<ImageData>;
}

declare module "@jsquash/oxipng/optimise" {
  interface OptimiseOptions {
    interlace?: boolean;
    level?: number;
    optimiseAlpha?: boolean;
  }

  export default function optimise(
    data: ArrayBuffer | ImageData,
    options?: OptimiseOptions,
  ): Promise<ArrayBuffer>;
}

declare module "upng-js" {
  const UPNG: {
    encode(
      imgs: ArrayBuffer[],
      w: number,
      h: number,
      cnum: number,
      dels?: number[],
    ): ArrayBuffer;
    decode(buffer: ArrayBuffer): unknown;
    toRGBA8(img: unknown): ArrayBuffer[];
  };
  export default UPNG;
}
