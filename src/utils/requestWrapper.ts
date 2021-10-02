import { Octokit } from '@octokit/core';
import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import OctokitError from 'errors/OctokitError';
import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, wait } from './time';

let error = false;
let rateLimitReset = 0;
let resetMoment: moment.Moment;
let octokitLimits: number[];

const getLowestRateLimitIndex = () => {
  const i = octokitLimits.indexOf(Math.min(...octokitLimits));
  return i;
};

const getLowestRateLimit = () => {
  return octokitLimits[getLowestRateLimitIndex()];
};

const makeRequest = async <D>(
  octokits: Octokit[],
  request: (octokit: Octokit) => Promise<OctokitResponse<D>>
) => {
  const i = getLowestRateLimitIndex();

  try {
    const response = await request(octokits[i]);

    return response;
  } catch (err: any) {
    throw new OctokitError(err, i);
  }
};

const requestWrapper = async <D>(
  octokits: Octokit[],
  request: (octokit: Octokit) => Promise<OctokitResponse<D>>,
  retries = 1
): Promise<D> => {
  if (!octokitLimits)
    octokitLimits = Array.from({ length: octokits.length }, () => 0);

  try {
    const { data } = await makeRequest(octokits, request);

    if (error) await wait(resetMoment.diff(moment()));

    return data;
  } catch (err: any) {
    if (!(err instanceof OctokitError)) throw err;

    const { octokitErr, octokitIndex } = err;

    if (octokitErr.response?.data?.message === 'Repository access blocked')
      throw new RepoBlocked(octokitErr.response.data.block.reason);

    if (octokitErr.response?.headers['x-ratelimit-remaining'] !== '0') {
      if (retries) return requestWrapper(octokits, request, --retries);
      console.log(octokitErr);
      throw octokitErr;
    }

    octokitLimits[octokitIndex] =
      Number(octokitErr.response.headers['x-ratelimit-reset']) + 1;

    if (octokitLimits.every((l) => moment.unix(l).isAfter(moment()))) {
      const lowestRateLimitReset = getLowestRateLimit();

      if (lowestRateLimitReset > rateLimitReset) {
        resetMoment = moment.unix(lowestRateLimitReset);
        rateLimitReset = lowestRateLimitReset;
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
    }

    return requestWrapper(octokits, request, retries);
  }
};

export default requestWrapper;
