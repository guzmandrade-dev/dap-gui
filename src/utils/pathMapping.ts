// Path mapping utilities for converting between server and local paths

export function resolvePathMappings(
  serverPath: string,
  mappings: Record<string, string>,
  workspaceRoot: string
): string {
  for (const [serverPrefix, localPrefix] of Object.entries(mappings)) {
    const resolvedLocal = localPrefix.replace('${workspaceFolder}', workspaceRoot);
    if (serverPath.startsWith(serverPrefix)) {
      return serverPath.replace(serverPrefix, resolvedLocal);
    }
  }
  return serverPath;
}

export function resolveLocalToServerPath(
  localPath: string,
  mappings: Record<string, string>,
  workspaceRoot: string
): string {
  for (const [serverPrefix, localPrefix] of Object.entries(mappings)) {
    const resolvedLocal = localPrefix.replace('${workspaceFolder}', workspaceRoot);
    if (localPath.startsWith(resolvedLocal)) {
      return localPath.replace(resolvedLocal, serverPrefix);
    }
  }
  return localPath;
}

export function normalizePath(path: string): string {
  // Normalize path separators to forward slashes
  return path.replace(/\\/g, '/');
}

export function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

export function getDirectory(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : '';
}

export function isAbsolutePath(path: string): boolean {
  if (path.startsWith('/')) return true;
  if (/^[a-zA-Z]:/.test(path)) return true; // Windows drive letter
  return false;
}