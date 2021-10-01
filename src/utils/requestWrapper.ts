import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, wait } from './time';

let error = false;
let rateLimitReset: string;

const requestWrapper = async <D>(
  request: () => Promise<OctokitResponse<D>>,
  retries = 1
): Promise<D> => {
  try {
    const { data } = await request();

    if (error) {
      const resetMoment = moment.unix(Number(rateLimitReset) + 1);

      await wait(resetMoment.diff(moment()));
    }

    return data;
  } catch (err: any) {
    if (err.response?.data?.message === 'Repository access blocked')
      throw new RepoBlocked(err.response.data.block.reason);

    if (err.response?.headers['x-ratelimit-remaining'] !== '0') {
      if (retries) return requestWrapper(request, --retries);
      console.log(err);
      throw err;
    }

    const newRateLimitReset = err.response.headers['x-ratelimit-reset'];

    const resetMoment = moment.unix(Number(newRateLimitReset) + 1);

    if (rateLimitReset !== newRateLimitReset) {
      console.log(
        `\n[${getFormattedTime()}] Chegou ao limite de requisições. Retomando operação às ${resetMoment.format(
          'HH:mm:ss'
        )}`
      );

      rateLimitReset = newRateLimitReset;
      error = true;
    }

    await wait(resetMoment.diff(moment()));

    error = false;

    console.log(`\n[${getFormattedTime()}] Operação retomada.`);

    return requestWrapper(request, retries);
  }
};

export default requestWrapper;
