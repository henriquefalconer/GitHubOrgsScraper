import { components } from '@octokit/openapi-types';

export type PublicUser = components['schemas']['public-user'];

export type RepoWithEvents = components['schemas']['minimal-repository'] & {
  last_90_days_events_count: number;
};

export interface Organization {
  login: string;
  id: number;
  avatarUrl: string;
  htmlUrl: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  totalRepoStars: number;
  totalRepoWatchers: number;
  totalRepoForks: number;
  totalRepoOpenIssues: number;
  totalRepoLast90DaysEvents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapingResult {
  nextPageToScrape: number;
  searchingDate: string;
  organizations: Organization[];
}
