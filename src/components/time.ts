const KST = 'Asia/Seoul';

const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', timeZone: KST });
const dayFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: KST });
const keyFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: KST });
const fullFmt = new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: KST,
});

/** "오전 9:12" */
export const formatTime = (ms: number) => timeFmt.format(ms);
/** "10월 21일 화요일" */
export const formatDay = (ms: number) => dayFmt.format(ms);
/** "10. 21. 오전 9:12" */
export const formatDateTime = (ms: number) => fullFmt.format(ms);
/** Same string for every moment of one KST calendar day. */
export const dayKey = (ms: number) => keyFmt.format(ms);
