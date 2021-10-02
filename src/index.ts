import dotenv from 'dotenv';

import Scraper from 'classes/Scraper';

dotenv.config();

const scraper = new Scraper();

const tokenString = process.env.PERSONAL_ACCESS_TOKEN_LIST ?? '';

scraper.setup({
  personalAccessTokens: tokenString.split(' '),
  baseQuery:
    'location:brazil location:brasil location:"São Paulo" type:org repos:>0',
  resultLocation: 'src/result.json',
});

scraper.run();
