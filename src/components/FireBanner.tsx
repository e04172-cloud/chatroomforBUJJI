export function FireBanner({ nextLabel }: { nextLabel: string | null }) {
  return (
    <div className="firebanner" role="status">
      <span aria-hidden>💨</span>
      <div>
        <b>주방장이 냄비 불을 껐어요.</b>
        <br />불이 다시 켜질 때까지 대화를 쓸 수 없어요.
        {nextLabel && <><br /><span className="next">{nextLabel}</span></>}
      </div>
    </div>
  );
}
