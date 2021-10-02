import { Octokit } from '@octokit/core';
import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import OctokitError from 'errors/OctokitError';
import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, wait } from '../utils/time';

interface IRequestController {
  makeRequest<D>(
    request: (octokit: Octokit) => Promise<OctokitResponse<D>>,
    retries?: number
  ): Promise<D>;
}

export default class RequestController implements IRequestController {
  private octokits: Octokit[];
  private error = false;
  private currentRateLimitReset = 0;
  private resetMoment: moment.Moment;
  private rateLimitResets: number[];

  private getLowestRateLimitIndex() {
    const i = this.rateLimitResets.indexOf(Math.min(...this.rateLimitResets));
    return i;
  }

  private getLowestRateLimitReset() {
    return this.rateLimitResets[this.getLowestRateLimitIndex()];
  }

  private async makeCatchableRequest<D>(
    request: (octokit: Octokit) => Promise<OctokitResponse<D>>
  ) {
    const i = this.getLowestRateLimitIndex();

    try {
      const response = await request(this.octokits[i]);

      return response;
    } catch (err: any) {
      throw new OctokitError(err, i);
    }
  }

  constructor(octokits: Octokit[]) {
    this.octokits = octokits;
    this.rateLimitResets = Array.from({ length: octokits.length }, () => 0);
  }

  async makeRequest<D>(
    request: (octokit: Octokit) => Promise<OctokitResponse<D>>,
    retries = 1
  ): Promise<D> {
    try {
      const { data } = await this.makeCatchableRequest(request);

      if (this.error) await wait(this.resetMoment.diff(moment()));

      return data;
    } catch (err: any) {
      if (!(err instanceof OctokitError)) throw err;

      const { octokitErr, octokitIndex } = err;

      if (octokitErr.response?.data?.message === 'Repository access blocked')
        throw new RepoBlocked(octokitErr.response.data.block.reason);

      if (octokitErr.response?.headers['x-ratelimit-remaining'] !== '0') {
        if (retries) return this.makeRequest(request, --retries);
        console.log(octokitErr);
        throw octokitErr;
      }

      this.rateLimitResets[octokitIndex] =
        Number(octokitErr.response.headers['x-ratelimit-reset']) + 1;

      if (this.rateLimitResets.every((l) => moment.unix(l).isAfter(moment()))) {
        const lowestRateLimitReset = this.getLowestRateLimitReset();

        if (lowestRateLimitReset > this.currentRateLimitReset) {
          this.resetMoment = moment.unix(lowestRateLimitReset);
          this.currentRateLimitReset = lowestRateLimitReset;
          this.error = true;

          console.log(
            `\n[${getFormattedTime()}] Chegou ao limite de requisições. Retomando operação às ${this.resetMoment.format(
              'HH:mm:ss'
            )}`
          );
        }

        await wait(this.resetMoment.diff(moment()));

        if (this.error)
          console.log(`\n[${getFormattedTime()}] Operação retomada.`);

        this.error = false;
      }

      return this.makeRequest(request, retries);
    }
  }
}
