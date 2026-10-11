import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createMissingModuleResolver,
  createProjectJiti,
  registerMissingModuleFallback,
} from './project-jiti';

describe('cli/utils/project-jiti', () => {
  test('forces tryNative off for project parse-time imports', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitcn-project-jiti-'));
    const previous = process.env.JITI_TRY_NATIVE;

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'project-jiti-test', private: true }, null, 2)
    );

    try {
      process.env.JITI_TRY_NATIVE = 'true';

      const jiti = createProjectJiti(dir);

      expect(jiti.options.tryNative).toBe(false);
    } finally {
      if (previous === undefined) {
        process.env.JITI_TRY_NATIVE = undefined;
      } else {
        process.env.JITI_TRY_NATIVE = previous;
      }
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  test('resolves missing project imports through a registered fallback until released', async () => {
    const dir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'kitcn-project-jiti-'))
    );
    const entryFile = path.join(dir, 'entry.ts');
    const fallbackFile = path.join(dir, 'outside', 'missing.ts');
    fs.mkdirSync(path.dirname(fallbackFile), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'present.ts'),
      'export const value = "present";'
    );
    fs.writeFileSync(fallbackFile, 'export const value = "fallback";');
    fs.writeFileSync(
      entryFile,
      `import { value as missing } from './missing';
import { value as present } from './present';
export const values = [missing, present];`
    );
    const requests: string[] = [];

    try {
      const release = registerMissingModuleFallback((request, parentFile) => {
        requests.push(request);
        return request === './missing' && parentFile === entryFile
          ? fallbackFile
          : undefined;
      });
      try {
        const module = (await createProjectJiti(dir).import(entryFile)) as {
          values: string[];
        };
        expect(module.values).toEqual(['fallback', 'present']);
      } finally {
        release();
      }
      expect(requests).toEqual(['./missing']);
      expect(fs.existsSync(path.join(dir, 'missing.ts'))).toBe(false);

      await expect(createProjectJiti(dir).import(entryFile)).rejects.toThrow(
        './missing'
      );
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  test('missing module resolver falls through when TypeScript is unavailable or throws', () => {
    const parentFile = path.join(os.tmpdir(), 'entry.ts');
    let loads = 0;
    const unavailable = createMissingModuleResolver(() => null);
    const throwing = createMissingModuleResolver(() => {
      loads++;
      throw new Error('typescript failed to load');
    });

    expect(unavailable('#runtime', parentFile)).toBeUndefined();
    expect(throwing('#runtime', parentFile)).toBeUndefined();
    expect(throwing('#runtime', parentFile)).toBeUndefined();
    expect(loads).toBe(1);
  });
});
