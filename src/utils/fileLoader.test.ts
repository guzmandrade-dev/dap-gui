import { describe, it, expect } from 'vitest';
import { getLanguageForFile, isTextFile } from './fileLoader';

describe('getLanguageForFile', () => {
  it('detects PHP files', () => {
    expect(getLanguageForFile('/var/www/index.php')).toBe('php');
  });

  it('detects JavaScript files', () => {
    expect(getLanguageForFile('/app/main.js')).toBe('javascript');
  });

  it('detects TypeScript files', () => {
    expect(getLanguageForFile('/src/app.ts')).toBe('typescript');
  });

  it('detects JSON files', () => {
    expect(getLanguageForFile('/config/settings.json')).toBe('json');
  });

  it('detects Markdown files', () => {
    expect(getLanguageForFile('/docs/readme.md')).toBe('markdown');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageForFile('/file.unknown')).toBe('plaintext');
  });

  it('handles files without extensions', () => {
    expect(getLanguageForFile('/Dockerfile')).toBe('plaintext');
  });
});

describe('isTextFile', () => {
  it('returns true for source code files', () => {
    expect(isTextFile('index.php')).toBe(true);
    expect(isTextFile('app.ts')).toBe(true);
    expect(isTextFile('style.css')).toBe(true);
  });

  it('returns false for binary files', () => {
    expect(isTextFile('image.png')).toBe(false);
    expect(isTextFile('archive.zip')).toBe(false);
    expect(isTextFile('document.pdf')).toBe(false);
  });

  it('returns true for files without extension', () => {
    expect(isTextFile('README')).toBe(true);
  });
});
