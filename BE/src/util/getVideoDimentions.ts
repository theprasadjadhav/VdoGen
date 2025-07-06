import type { AspectRatioType, ResolutionType } from "../types/types";

const resolutionMap: Record<AspectRatioType, Record<ResolutionType, { width: number; height: number }>> = {
  '16:9': {
    '360p': { width: 640, height: 360 },
    '480p': { width: 854, height: 480 },
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
  },
  '9:16': {
    '360p': { width: 360, height: 640 },
    '480p': { width: 480, height: 854 },
    '720p': { width: 720, height: 1280 },
    '1080p': { width: 1080, height: 1920 },
  },
  '4:3': {
    '360p': { width: 480, height: 360 },
    '480p': { width: 640, height: 480 },
    '720p': { width: 960, height: 720 },
    '1080p': { width: 1440, height: 1080 },
  }
};

export function getVideoDimensions(aspectRatio: AspectRatioType, resolution: ResolutionType): string {
  const dims = resolutionMap[aspectRatio]?.[resolution];

  if (!dims) {
    throw new Error(`Unsupported combination: ${aspectRatio} at ${resolution}`);
  }

  return `${dims.width},${dims.height}`;
}