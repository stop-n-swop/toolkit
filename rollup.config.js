import babel from 'rollup-plugin-babel';
import localResolve from 'rollup-plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';
import pkg from './package.json';

const configs = {
  input: `src/index.ts`,
  output: [
    {
      file: 'dist/es/toolkit.js',
      format: 'es',
    },
    {
      file: `dist/cjs/toolkit.js`,
      format: 'cjs',
    },
  ],
  plugins: [
    localResolve({
      extensions: ['.js', '.ts'],
    }),
    babel({
      exclude: 'node_modules/**',
      extensions: ['.js', '.ts'],
    }),
    cleanup({
      extensions: ['js', 'ts'],
      sourcemap: false,
    }),
  ],
  external: [
    ...Object.keys(pkg.peerDependencies),
    ...Object.keys(pkg.dependencies),
    'crypto',
  ],
};

export default configs;
