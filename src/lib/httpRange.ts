export interface RangeRequestResult {
  isRange: boolean;
  start: number;
  end: number;
  chunkLength: number;
  totalSize: number;
  contentRangeHeader?: string;
  status: 200 | 206 | 416;
  errorMessage?: string;
}

/**
 * Parses HTTP Range header string and calculates byte slice coordinates
 */
export function parseRangeHeader(rangeHeader: string | undefined, totalSize: number): RangeRequestResult {
  if (!rangeHeader || typeof rangeHeader !== 'string') {
    return {
      isRange: false,
      start: 0,
      end: Math.max(0, totalSize - 1),
      chunkLength: totalSize,
      totalSize,
      status: 200,
    };
  }

  const trimmed = rangeHeader.trim();
  if (!trimmed.startsWith('bytes=')) {
    return {
      isRange: false,
      start: 0,
      end: Math.max(0, totalSize - 1),
      chunkLength: totalSize,
      totalSize,
      status: 200,
    };
  }

  // Handle single range (multiple ranges in multipart/byteranges are rarely used by browsers like Chrome)
  const rangePart = trimmed.slice(6).split(',')[0].trim();
  const [startStr, endStr] = rangePart.split('-');

  let start: number;
  let end: number;

  if (startStr === '') {
    // Suffix byte range: "-500" means last 500 bytes
    const suffixLength = parseInt(endStr, 10);
    if (isNaN(suffixLength) || suffixLength <= 0) {
      return {
        isRange: true,
        start: 0,
        end: 0,
        chunkLength: 0,
        totalSize,
        status: 416,
        errorMessage: 'Invalid suffix length in range header',
      };
    }
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else if (endStr === '' || endStr === undefined) {
    // "500-" means from byte 500 to end
    start = parseInt(startStr, 10);
    end = totalSize - 1;
  } else {
    // "500-1000"
    start = parseInt(startStr, 10);
    end = parseInt(endStr, 10);
  }

  // Validate bounds
  if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
    return {
      isRange: true,
      start: 0,
      end: 0,
      chunkLength: 0,
      totalSize,
      status: 416,
      contentRangeHeader: `bytes */${totalSize}`,
      errorMessage: 'Requested range not satisfiable',
    };
  }

  // Clamp end to totalSize - 1
  end = Math.min(end, totalSize - 1);
  const chunkLength = end - start + 1;

  return {
    isRange: true,
    start,
    end,
    chunkLength,
    totalSize,
    contentRangeHeader: `bytes ${start}-${end}/${totalSize}`,
    status: 206,
  };
}
