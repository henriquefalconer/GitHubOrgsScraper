import moment from 'moment';

export const wait = (milliseconds: number) =>
  new Promise<void>((res) => setTimeout(res, milliseconds));

export const waitUntil = (time: moment.Moment) =>
  new Promise<void>((res) => {
    const ref = setInterval(() => {
      if (moment().isAfter(time)) {
        clearInterval(ref);
        res();
      }
    }, 1000);
  });

export const raceWaitUntil = (time: moment.Moment) =>
  Promise.race([wait(time.diff(moment())), waitUntil(time.add(1, 'second'))]);

export const getPreviousWeek = (date: string) =>
  moment(date, 'YYYY-MM-DD').subtract(1, 'week').format('YYYY-MM-DD');

export const getFormattedTime = () => moment().format('HH:mm:ss.SS');
