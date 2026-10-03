'use strict';

/**
 * Verificación del contenido real de un archivo subido («números mágicos»).
 * La extensión la elige quien sube el archivo; los primeros bytes, no. Así se
 * rechaza, por ejemplo, una página HTML o un ejecutable renombrado como .pdf o .jpg.
 */

const fs = require('node:fs');

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, text, offset = 0) => buf.slice(offset, offset + text.length).toString('latin1') === text;

const isJpeg = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isPng = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isGif = (b) => ascii(b, 'GIF87a') || ascii(b, 'GIF89a');
const isWebp = (b) => ascii(b, 'RIFF') && ascii(b, 'WEBP', 8);
const isIsoMedia = (b) => ascii(b, 'ftyp', 4); // HEIC/HEIF, MP4, MOV, M4V
const isWebm = (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]);
const isPdf = (b) => ascii(b, '%PDF-');
const isZip = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]); // DOCX, XLSX, PPTX, ODT
const isOle = (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // DOC, XLS, PPT
const isPlainText = (b) => {
  if (b.includes(0x00)) return false;
  const head = b.toString('utf8').trimStart().toLowerCase();
  return !head.startsWith('<') && !head.startsWith('%!'); // ni HTML/SVG/XML ni PostScript
};

const CHECKS = {
  '.jpg': isJpeg, '.jpeg': isJpeg, '.png': isPng, '.gif': isGif, '.webp': isWebp,
  '.heic': isIsoMedia, '.heif': isIsoMedia,
  '.mp4': isIsoMedia, '.mov': isIsoMedia, '.m4v': isIsoMedia, '.webm': isWebm,
  '.pdf': isPdf,
  '.docx': isZip, '.xlsx': isZip, '.pptx': isZip, '.odt': isZip,
  '.doc': isOle, '.xls': isOle, '.ppt': isOle,
  '.txt': isPlainText,
};

/** true si el contenido del archivo corresponde a su extensión. */
function checkSignature(filePath, ext) {
  const check = CHECKS[String(ext || '').toLowerCase()];
  if (!check) return false;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const n = fs.readSync(fd, buf, 0, 512, 0);
    return n > 0 && check(buf.subarray(0, n));
  } catch (_) {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { checkSignature };
