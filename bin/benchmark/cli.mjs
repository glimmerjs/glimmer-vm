import { inspect } from 'node:util';
import { isNativeError } from 'node:util/types';

import { formatHelpMessage, peowly } from 'peowly';
import { chalk } from 'zx';

/**
 * @import { AnyFlags, PeowlyResult, TypedFlags } from 'peowly';
 * @import { OmitProperties, PickProperties, } from 'ts-essentials';
 */

const style = {
  header: chalk.redBright.bold,
  err: chalk.red,
  punct: chalk.gray,
  value: chalk.magentaBright,
  as: chalk.cyan,
  for: chalk.green,
};

/**
 * @template {AnyFlags} const Flags
 * @param {string} name
 * @param {object} options
 * @param {string} options.usage
 * @param {string} options.version
 * @param {Flags} flags
 */
export function Cli(name, options, flags) {
  const help = formatHelpMessage(name, { ...options, flags });

  function tryParse() {
    try {
      return peowly({
        name,
        help,
        ...options,
        options: {
          ...flags,
          loglevel: {
            type: 'string',
            short: 'l',
            description: 'Log level (trace, debug, error)',
            default: 'error',
          },
        },
      });
    } catch (err) {
      if (
        isNativeError(err) &&
        /** @type {{ code?: string }} */ (err).code?.startsWith('ERR_PARSE_ARGS_')
      ) {
        const line = style.err('-'.repeat(process.stdout.columns));

        console.error(
          `${line}\n\n${style.header.inverse('Error')} ${style.header.italic(
            err.message
          )}\n\n${line}\n`
        );

        exitWithUsage();
      }

      throw err;
    }
  }

  function parse() {
    const parsed = tryParse();

    /**
     * @template {string[]}  Variants
     * @param {string & keyof PickProperties<Flags, {type: 'string'}> | 'loglevel'} flagName the value parsed by peowly
     * @param {Variants} variants the list of valid values
     * @param {object} options
     * @param {string} options.as the name of the flag
     * @param {string} [options.for] the name of the scenario
     * @return {Variants[number] | undefined}
     */

    function getEnumFlag(flagName, variants, { as: asThe, for: forThe }) {
      const parsedValue = /** @type {string | undefined} */ (
        parsed.flags[/** @type {keyof PeowlyResult<Flags>} */ (flagName)]
      );

      if (parsedValue === undefined) {
        return undefined;
      }

      if (variants.includes(parsedValue)) {
        return parsedValue;
      }

      switch (parsedValue) {
        case 'off':
        case 'repeat':
        case 'reset':
        case 'rebuild':
          return parsedValue;
        default: {
          const line = style.err('-'.repeat(process.stdout.columns));

          let forTheMessage = forThe
            ? ` ${style.err('for the')} ${style.for(forThe)} ${style.err('scenario')}`
            : '';

          console.error(
            `${line}\n\n${style.header.inverse('Error')} ${style.header.italic(
              'Invalid'
            )} ${style.as.bold.italic(`--${flagName}`)}\n\n  ${style.err(
              'You specified '
            )}${style.value.underline(parsedValue)} ${style.err('as the')} ${style.as(
              asThe
            )}${forTheMessage}${style.punct(', ')}${style.err(
              `but it must be one of`
            )}${style.punct(':')}\n\n${variants
              .map((mode) => `  ${style.punct('-')} ${style.value(mode)}`)
              .join(`\n`)}\n\n${line}\n`
          );
          exitWithUsage();
        }
      }
    }

    const loglevel = getEnumFlag('loglevel', ['trace', 'debug', 'error'], {
      as: 'log level',
    });

    return {
      [Symbol.for('nodejs.util.inspect.custom')]() {
        return inspect(parsed.flags);
      },
      flags: parsed.flags,
      loglevel: {
        shouldTrace: loglevel === 'trace',
        shouldDebug: loglevel === 'debug' || loglevel === 'trace',
      },
      getEnumFlag,
    };
  }

  /**
   * @returns {never}
   */
  function exitWithUsage() {
    console.error(help);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }

  return { parse };
}
