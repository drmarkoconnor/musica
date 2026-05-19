import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "./env";

export const LOCAL_PIECE_ASSET_BUCKET = "local-docs";
export const LOCAL_LEAD_SHEET_STORAGE_PREFIX = "docs/leadsheets/";
export const LOCAL_PIECE_ASSET_STORAGE_PREFIX = "docs/piece-assets/";
export const NETLIFY_PIECE_ASSET_BUCKET = "netlify-blobs";
export const NETLIFY_PIECE_ASSET_STORE = "piece-assets";
export const NETLIFY_PIECE_ASSET_STORAGE_PREFIX = "netlify-blobs/piece-assets/";

async function netlifyBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  const siteID = serverEnv("NETLIFY_SITE_ID") ?? serverEnv("SITE_ID");
  const token =
    serverEnv("NETLIFY_BLOBS_TOKEN") ??
    serverEnv("NETLIFY_AUTH_TOKEN") ??
    serverEnv("NETLIFY_TOKEN");

  if (siteID && token) {
    return getStore({
      name: NETLIFY_PIECE_ASSET_STORE,
      siteID,
      token,
    });
  }

  return getStore(NETLIFY_PIECE_ASSET_STORE);
}

export function pieceAssetContentTypeForPath(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();

  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";

  return "application/octet-stream";
}

export function inlineAssetDisposition(filename: string) {
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
}

export function localPieceAssetStoragePath(fileName: string) {
  return `${LOCAL_PIECE_ASSET_STORAGE_PREFIX}${fileName}`;
}

export function netlifyPieceAssetStoragePath(fileName: string) {
  return `${NETLIFY_PIECE_ASSET_STORAGE_PREFIX}${fileName}`;
}

function safeLocalFilePath(storagePath: string) {
  const normalizedPath = storagePath.replace(/\\/g, "/");
  const filename = path.posix.basename(normalizedPath);

  if (
    filename.length === 0 ||
    !/^[a-z0-9 ._'(),&+-]+$/i.test(filename)
  ) {
    return null;
  }

  if (normalizedPath === `${LOCAL_LEAD_SHEET_STORAGE_PREFIX}${filename}`) {
    return path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "docs/leadsheets",
      filename,
    );
  }

  if (normalizedPath === `${LOCAL_PIECE_ASSET_STORAGE_PREFIX}${filename}`) {
    return path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "docs/piece-assets",
      filename,
    );
  }

  return null;
}

function netlifyPieceAssetKey(storageBucket: string, storagePath: string) {
  if (
    storageBucket !== NETLIFY_PIECE_ASSET_BUCKET ||
    !storagePath.startsWith(NETLIFY_PIECE_ASSET_STORAGE_PREFIX)
  ) {
    return null;
  }

  const key = storagePath.slice(NETLIFY_PIECE_ASSET_STORAGE_PREFIX.length);

  if (
    key.length === 0 ||
    key !== path.basename(key) ||
    !/^[a-z0-9._-]+$/i.test(key)
  ) {
    return null;
  }

  return key;
}

export async function readPieceAssetBuffer({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}) {
  if (storageBucket === LOCAL_PIECE_ASSET_BUCKET) {
    const filePath = safeLocalFilePath(storagePath);

    if (!filePath) return null;

    return readFile(filePath).catch(() => null);
  }

  const key = netlifyPieceAssetKey(storageBucket, storagePath);

  if (!key) return null;

  const store = await netlifyBlobStore();
  const entry = await store.get(key, { type: "arrayBuffer" });

  if (!entry) return null;

  return Buffer.from(entry);
}
