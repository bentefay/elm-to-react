#!/usr/bin/env node

import { Command, Options } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Console, Effect } from 'effect';

// Define CLI options
const entryOption = Options.file('entry').pipe(
  Options.withDescription('Entry point Elm file(s) to transpile')
);

const elmProjectOption = Options.file('elm-project').pipe(
  Options.withDefault('./elm.json'),
  Options.withDescription('Path to elm.json')
);

const outDirOption = Options.directory('out').pipe(
  Options.withDefault('./gen'),
  Options.withDescription('Output directory for generated TypeScript')
);

const matchLibOption = Options.choice('match', ['ts-pattern', 'effect']).pipe(
  Options.withDefault('ts-pattern' as const),
  Options.withDescription('Pattern matching library to use')
);

const pipeLibOption = Options.choice('pipe', ['remeda', 'effect']).pipe(
  Options.withDefault('remeda' as const),
  Options.withDescription('Pipe/flow library to use')
);

// Transpile command
const transpileCommand = Command.make('transpile', {
  entry: entryOption,
  elmProject: elmProjectOption,
  outDir: outDirOption,
  matchLib: matchLibOption,
  pipeLib: pipeLibOption,
}).pipe(
  Command.withHandler(({ entry, elmProject, outDir, matchLib, pipeLib }) =>
    Effect.gen(function* () {
      yield* Console.log('🌳 elm-to-react transpiler');
      yield* Console.log('');
      yield* Console.log(`Entry: ${entry}`);
      yield* Console.log(`Elm project: ${elmProject}`);
      yield* Console.log(`Output directory: ${outDir}`);
      yield* Console.log(`Match library: ${matchLib}`);
      yield* Console.log(`Pipe library: ${pipeLib}`);
      yield* Console.log('');
      yield* Console.log('⚠️  Transpilation not yet implemented');

      // TODO: Implement transpilation
      // 1. Parse entry file with tree-sitter
      // 2. Walk CST and emit TypeScript
      // 3. Write to output directory
    })
  )
);

// Root command
const cli = Command.make('elm-to-react', {}, transpileCommand).pipe(
  Command.withDescription(
    'A source-to-source transpiler from Elm to TypeScript/React'
  )
);

// Run the CLI
const run = Effect.suspend(() => cli(process.argv.slice(2)));

NodeRuntime.runMain(run.pipe(Effect.provide(NodeContext.layer)));
