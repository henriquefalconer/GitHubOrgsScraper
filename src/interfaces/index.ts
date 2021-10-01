import { components } from '@octokit/openapi-types';

export type PublicUser = components['schemas']['public-user'];

export type RepoWithEvents = components['schemas']['minimal-repository'] & {
  last_90_days_events_count: number;
};

export type Organization = PublicUser & {
  repos: RepoWithEvents[];
  total_repo_stars: number;
  total_repo_last_90_days_events_count: number;
};

export interface ScrapingResult {
  nextPageToScrape: number;
  organizations: Organization[];
}
