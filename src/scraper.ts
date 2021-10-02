import { Octokit } from '@octokit/core';
import moment from 'moment';

import {
  Organization,
  PublicUser,
  RepoWithEvents,
  ScrapingResult,
} from 'interfaces';

import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, getPreviousWeek } from 'utils/time';
import { readJSONFile, saveJSONFile } from 'utils/json';
import requestWrapper from 'utils/requestWrapper';

interface ScraperConfig {
  personalAccessTokens: string[];
  baseQuery: string;
  resultLocation: string;
}

interface IScraper {
  setup({
    personalAccessTokens,
    baseQuery,
    resultLocation,
  }: ScraperConfig): void;
  run(): Promise<void>;
}

const PER_PAGE = 100;

export default class Scraper implements IScraper {
  private octokits: Octokit[];
  private baseQuery: string;
  private resultLocation: string;
  private nextPageToScrape: number;
  private date: string;
  private organizations: Organization[];
  private totalCount: number;
  private oldestOrgDate: string;

  private readFile() {
    try {
      const result = readJSONFile<ScrapingResult>(this.resultLocation);
      this.nextPageToScrape = result.nextPageToScrape;
      this.date = result.searchingDate;
      this.organizations = result.organizations;
    } catch {
      this.nextPageToScrape = 1;
      this.date = moment().format('YYYY-MM-DD');
      this.organizations = [];
    }
  }

  private saveToFile() {
    const result = {
      nextPageToScrape: this.nextPageToScrape,
      searchingDate: this.date,
      organizations: this.organizations,
    };

    saveJSONFile<ScrapingResult>(this.resultLocation, result);
  }

  private async getMetadata() {
    const {
      items: [oldestOrg],
      total_count,
    } = await requestWrapper(this.octokits, (octokit) =>
      octokit.request('GET /search/users', {
        q: this.baseQuery,
        sort: 'joined',
        order: 'asc',
      })
    );

    const oldestData = await requestWrapper(this.octokits, (octokit) =>
      octokit.request('GET /users/{username}', {
        username: oldestOrg.login,
      })
    );
    const publicUser = oldestData as PublicUser;

    this.totalCount = total_count;
    this.oldestOrgDate = publicUser.created_at;
  }

  public setup({
    personalAccessTokens,
    baseQuery,
    resultLocation,
  }: ScraperConfig) {
    this.octokits = personalAccessTokens.map((t) => new Octokit({ auth: t }));
    this.baseQuery = baseQuery;
    this.resultLocation = resultLocation;

    this.readFile();
  }

  public async run() {
    await this.getMetadata();

    while (moment(this.date, 'YYYY-MM-DD').isAfter(this.oldestOrgDate)) {
      const dateCreated = `created:${getPreviousWeek(this.date)}..${this.date}`;

      const orgs = await requestWrapper(this.octokits, (octokit) =>
        octokit.request('GET /search/users', {
          q: `${this.baseQuery} ${dateCreated}`,
          page: this.nextPageToScrape,
          per_page: PER_PAGE,
        })
      );

      await Promise.all(
        orgs.items.map(async (organization) => {
          if (this.organizations.some((o) => o.login === organization.login))
            return;

          const data = await requestWrapper(this.octokits, (octokit) =>
            octokit.request('GET /users/{username}', {
              username: organization.login,
            })
          );
          const publicUser = data as PublicUser;

          const rawRepos = await requestWrapper(this.octokits, (octokit) =>
            octokit.request('GET /users/{username}/repos', {
              username: organization.login,
            })
          );

          const repos: RepoWithEvents[] = [];

          await Promise.all(
            rawRepos.map(async (repo) => {
              let last_90_days_events_count: number;

              try {
                const events = await requestWrapper(this.octokits, (octokit) =>
                  octokit.request('GET /repos/{owner}/{repo}/events', {
                    owner: organization.login,
                    repo: repo.name,
                  })
                );
                last_90_days_events_count = events.length;
              } catch (err) {
                if (!(err instanceof RepoBlocked)) throw err;
                last_90_days_events_count = 0;
              }

              repos.push({ ...repo, last_90_days_events_count });
            })
          );

          const totalRepoStars = repos.reduce(
            (acc, r) => acc + (r.stargazers_count ?? 0),
            0
          );
          const totalRepoWatchers = repos.reduce(
            (acc, r) => acc + (r.watchers_count ?? 0),
            0
          );
          const totalRepoForks = repos.reduce(
            (acc, r) => acc + (r.forks_count ?? 0),
            0
          );
          const totalRepoOpenIssues = repos.reduce(
            (acc, r) => acc + (r.open_issues_count ?? 0),
            0
          );
          const totalRepoLast90DaysEvents = repos.reduce(
            (acc, r) => acc + r.last_90_days_events_count,
            0
          );

          const {
            login,
            avatar_url,
            html_url,
            name,
            blog,
            location,
            email,
            bio,
            twitter_username,
            public_repos,
            created_at,
          } = publicUser;

          const org: Organization = {
            login,
            avatarUrl: avatar_url,
            htmlUrl: html_url,
            name,
            blog,
            location,
            email,
            bio,
            twitterUsername: twitter_username ?? null,
            createdAt: created_at,
            publicRepos: public_repos,
            totalRepoStars,
            totalRepoWatchers,
            totalRepoForks,
            totalRepoOpenIssues,
            totalRepoLast90DaysEvents,
          };

          this.organizations = [...this.organizations, org];

          this.saveToFile();

          const count = this.organizations.length;
          const stats = `[${count}/${this.totalCount} - ${getFormattedTime()}]`;
          const info = `${org.name} (${org.login})`;
          const numbers = `${totalRepoLast90DaysEvents} eventos recentes\t${totalRepoStars} estrelas em seus repositórios`;

          console.log(`\n${stats} ${info}:\n${numbers}`);
        })
      );

      if (
        PER_PAGE * (this.nextPageToScrape - 1) + orgs.items.length >=
        orgs.total_count
      ) {
        this.date = getPreviousWeek(this.date);
        this.nextPageToScrape = 1;
      } else this.nextPageToScrape++;

      this.saveToFile();
    }

    console.log(`\n[${getFormattedTime()}] Processo finalizado.\n`);
  }
}
