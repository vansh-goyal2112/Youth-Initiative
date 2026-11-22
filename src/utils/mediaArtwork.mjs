const ARTWORK_PATH = /^\/api\/media\/artwork\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/;

export function artworkIdFromPath(path) {
  return ARTWORK_PATH.exec(path || "")?.[1] || null;
}
