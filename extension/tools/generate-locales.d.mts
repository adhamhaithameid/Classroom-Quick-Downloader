// filepath: extension/tools/generate-locales.d.mts
/**
 * Type declarations for generate-locales.mjs (see that file for full docs).
 * The generator is plain ESM JavaScript so it can run standalone via
 * `node tools/generate-locales.mjs`; this keeps its consumers typed.
 */

/** camelCase/`after_posting` t() key -> chrome.i18n message name ([a-zA-Z0-9_]). */
export function toMessageKey(key: string): string;

/** TRANSLATIONS locale code -> chrome.i18n directory name (en_US style). */
export function toDirName(locale: string): string;

/** chrome.i18n directory name back to the TRANSLATIONS locale code. */
export function fromDirName(dir: string): string;

/** One chrome.i18n message entry: exact string + original t() key. */
export interface LocaleMessage {
  message: string;
  description: string;
}

/** Build the chrome.i18n messages object for one locale table. */
export function buildLocaleMessages(
  locale: string,
  table: Record<string, string>,
): Record<string, LocaleMessage>;

/** Serialize one locale's messages.json exactly as the generator writes it. */
export function serializeMessages(messages: Record<string, LocaleMessage>): string;

/** Build every locale from TRANSLATIONS: {dirName -> messages.json content}. */
export function buildAllLocales(
  translations: Record<string, Record<string, string>>,
): Record<string, string>;

/**
 * Load TRANSLATIONS from i18n.ts by transpiling with the `typescript`
 * package and loading the result via createRequire (bundler-proof).
 */
export function loadTranslationsFromSource(
  sourcePath?: string,
): Record<string, Record<string, string>>;

/** Compare generated output against one locale root on disk; returns drift descriptions. */
export function diffLocalesRoot(rootDir: string, files: Record<string, string>): string[];

/**
 * Whether the web-ext manifest (wxt.config.ts) declares `default_locale`.
 * Gates whether the generator emits the bundle copy of _locales (see the
 * module docstring — Chrome rejects _locales without default_locale).
 */
export function manifestDeclaresDefaultLocale(configPath?: string): boolean;

/** Write generated files into one locale root and prune removed locales. */
export function writeLocalesRoot(rootDir: string, files: Record<string, string>): number;

/** Compare generated output against the tree on disk; returns drift descriptions. */
export function diffAgainstDisk(files: Record<string, string>): string[];

/** Write all generated files and prune locale dirs removed from TRANSLATIONS. */
export function writeToDisk(files: Record<string, string>): number;
