import fs from 'node:fs';
import path from 'node:path';

/**
 * Which R the trial asks about its libraries: the one RStudio will start.
 *
 * RStudio starts the R that RSTUDIO_WHICH_R names, when it is set, and the
 * engine hands a Route this process's environment, so setting it here picks a
 * Route's R. The R library guard and the personal library both ask R where its
 * libraries are, and asked the Rscript on the PATH whatever RStudio started:
 * measured on 2026-10-05, a replay under R 4.4.3 had its guard watch R 4.6's
 * library and its Routes see 4.6's personal library, not 4.4's, which exists,
 * while the guard reported nothing changed. So both ask this R instead.
 */
export const WHICH_R_VARIABLE = 'RSTUDIO_WHICH_R';

/**
 * The Rscript to ask: the one beside the R that RSTUDIO_WHICH_R names, or the
 * PATH's where it is unset. A value naming no R, or an R with no Rscript beside
 * it, is refused by name rather than answered from the PATH, which is the
 * wrong R that the variable was set to avoid.
 */
export function rscript(raw: string | undefined = process.env[WHICH_R_VARIABLE]): string {
  const named = (raw ?? '').trim();
  if (named === '') return 'Rscript';
  const refuse = (why: string) =>
    new Error(`${WHICH_R_VARIABLE}=${JSON.stringify(named)} ${why}, so which R RStudio starts is unknown. Unset it, or name an R.`);
  if (!fs.existsSync(named)) throw refuse('names nothing');
  const beside = path.join(path.dirname(named), 'Rscript');
  if (!fs.existsSync(beside)) throw refuse('has no Rscript beside it');
  return beside;
}
