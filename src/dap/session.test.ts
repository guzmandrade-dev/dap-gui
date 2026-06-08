import { describe, it, expect } from 'vitest';
import { DebugSession } from './session';
import { LaunchConfiguration } from './types';

describe('DebugSession path mapping', () => {
  const createSession = (pathMappings?: Record<string, string>) => {
    const config: LaunchConfiguration = {
      type: 'php',
      request: 'launch',
      name: 'Test',
      pathMappings,
    };
    return new DebugSession(config, '/workspace');
  };

  describe('serverToLocalPath', () => {
    it('maps a server path to local using workspaceFolder', () => {
      const session = createSession({
        '/var/www/html': '${workspaceFolder}',
      });
      expect(session.serverToLocalPath('/var/www/html/index.php')).toBe('/workspace/index.php');
    });

    it('maps a server path to an absolute local path', () => {
      const session = createSession({
        '/server/app': '/local/app',
      });
      expect(session.serverToLocalPath('/server/app/src/main.php')).toBe('/local/app/src/main.php');
    });

    it('returns the original path when no mapping matches', () => {
      const session = createSession({
        '/var/www/html': '${workspaceFolder}',
      });
      expect(session.serverToLocalPath('/other/path/file.php')).toBe('/other/path/file.php');
    });

    it('handles multiple mappings', () => {
      const session = createSession({
        '/var/www/html': '${workspaceFolder}',
        '/shared/lib': '/workspace/vendor',
      });
      expect(session.serverToLocalPath('/shared/lib/utils.php')).toBe('/workspace/vendor/utils.php');
    });
  });

  describe('localToServerPath', () => {
    it('maps a local path to server using workspaceFolder', () => {
      const session = createSession({
        '/var/www/html': '${workspaceFolder}',
      });
      // localToServerPath is private, but we can test it via setBreakpoints indirectly
      // or we can access it via any method. Since it's private, we'll test behavior through
      // the public interface. For now, we test serverToLocalPath which is public.
      // To test localToServerPath properly, we can use a workaround:
      expect((session as any).localToServerPath('/workspace/index.php')).toBe('/var/www/html/index.php');
    });

    it('returns the original path when no reverse mapping matches', () => {
      expect((createSession({ '/var/www/html': '${workspaceFolder}' }) as any).localToServerPath('/other/file.php')).toBe('/other/file.php');
    });
  });

  describe('workspaceFolder resolution', () => {
    it('resolves ${workspaceFolder} in the constructor', () => {
      const session = createSession({
        '/app': '${workspaceFolder}/src',
      });
      expect(session.serverToLocalPath('/app/index.php')).toBe('/workspace/src/index.php');
    });

    it('handles empty path mappings', () => {
      const session = createSession(undefined);
      expect(session.serverToLocalPath('/anything.php')).toBe('/anything.php');
    });
  });
});
