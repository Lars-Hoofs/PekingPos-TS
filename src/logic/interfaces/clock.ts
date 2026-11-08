/** Where the services get the current time from, so a test can fix the time. */
export interface Clock {
  now(): Date;
}
