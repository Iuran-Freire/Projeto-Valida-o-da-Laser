// iPhone cameras store photos sideways plus an EXIF "rotate" tag. Browsers
// normally apply it while decoding, but some Safari versions did not for
// createImageBitmap (WebKit bugs 231063 and 237895): the photo then arrives
// lying down and the serial is searched in the wrong place. These helpers
// detect that case so the page turns the photo itself, and only then.

const SOF = (marker) =>
  marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

function exifOrientation(view, tiff, end) {
  if (tiff + 8 > end) return 0;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return 0;
  const little = order === 0x4949;
  if (view.getUint16(tiff + 2, little) !== 42) return 0;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  if (ifd + 2 > end) return 0;
  const count = view.getUint16(ifd, little);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) break;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 0;
    }
  }
  return 0;
}

// EXIF orientation and stored (not yet turned) size of a JPEG; null otherwise.
export function jpegOrientation(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2, orientation = 1, width = 0, height = 0;
  while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
    const marker = view.getUint8(offset + 1);
    if (marker === 0xff) { offset += 1; continue; } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { offset += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break; // image data starts
    const length = view.getUint16(offset + 2), start = offset + 4;
    if (length < 2) break;
    const end = Math.min(view.byteLength, offset + 2 + length);
    if (marker === 0xe1 && start + 6 <= end && view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0)
      orientation = exifOrientation(view, start + 6, end) || orientation;
    else if (SOF(marker) && start + 5 <= end) {
      height = view.getUint16(start + 1);
      width = view.getUint16(start + 3);
    }
    offset += 2 + length;
  }
  return width && height ? { orientation, width, height } : null;
}

// Turn the page still has to apply: only for quarter-turn photos (EXIF 5–8)
// that the browser decoded with their stored, unturned size.
export function missingOrientation(stored, decodedWidth, decodedHeight) {
  if (!stored || stored.orientation < 5 || stored.width === stored.height) return 1;
  return decodedWidth === stored.width && decodedHeight === stored.height
    ? stored.orientation
    : 1;
}

// Canvas transform that draws a width×height stored image upright.
export function orientationTransform(orientation, width, height) {
  switch (orientation) {
    case 5: return { matrix: [0, 1, 1, 0, 0, 0], width: height, height: width };
    case 6: return { matrix: [0, 1, -1, 0, height, 0], width: height, height: width };
    case 7: return { matrix: [0, -1, -1, 0, height, width], width: height, height: width };
    case 8: return { matrix: [0, -1, 1, 0, 0, width], width: height, height: width };
    default: return { matrix: [1, 0, 0, 1, 0, 0], width, height };
  }
}
