import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, wait } from './time';

let error = false;
let rateLimitReset = 0;
let resetMoment: moment.Moment;

const requestWrapper = async <D>(
  request: () => Promise<OctokitResponse<D>>,
  retries = 1
): Promise<D> => {
  try {
    const { data } = await request();

    if (error) await wait(resetMoment.diff(moment()));

    return data;
  } catch (err: any) {
    if (err.response?.data?.message === 'Repository access blocked')
      throw new RepoBlocked(err.response.data.block.reason);

    if (err.response?.headers['x-ratelimit-remaining'] !== '0') {
      if (retries) return requestWrapper(request, --retries);
      console.log(err);
      throw err;
    }

    const newRateLimitReset = Number(err.response.headers['x-ratelimit-reset']);

    if (newRateLimitReset > rateLimitReset) {
      resetMoment = moment.unix(newRateLimitReset + 1);
      rateLimitReset = newRateLimitReset;
      error = true;

      console.log(
        `\n[${getFormattedTime()}] Chegou ao limite de requisições. Retomando operação às ${resetMoment.format(
          'HH:mm:ss'
        )}`
      );
    }

    await wait(resetMoment.diff(moment()));

    if (error) console.log(`\n[${getFormattedTime()}] Operação retomada.`);

    error = false;

    return requestWrapper(request, retries);
  }
};

export default requestWrapper;
