import { expect, test, type Locator, type Page } from '@playwright/test';

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, animations: 'disabled' });

async function noSideScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, '가로 넘침 없음').toBeLessThanOrEqual(iw);
}

async function atLeast44(locators: Locator) {
  const n = await locators.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const box = await locators.nth(i).boundingBox();
    expect(box, `${i}번째 칸`).not.toBeNull();
    expect(box!.height, `${i}번째 칸 높이`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `${i}번째 칸 너비`).toBeGreaterThanOrEqual(44);
  }
}

async function loginStudent(page: Page, name = '김가은') {
  await page.goto('/');
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByLabel('암호').fill('1234');
  await page.getByRole('button', { name: '들어가기' }).click();
  await expect(page.getByText('내가 들어가 있는 냄비')).toBeVisible();
}

async function loginTeacher(page: Page) {
  await page.goto('/teacher');
  await expect(page.getByRole('button', { name: '구글 계정으로 로그인' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __budaeGoogleSignIn: () => Promise<unknown> }).__budaeGoogleSignIn());
  await expect(page.getByRole('tab', { name: '🍲 냄비' })).toBeVisible();
}

test('입장 화면', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '박서준' })).toBeVisible();
  await noSideScroll(page);
  await atLeast44(page.getByRole('group', { name: '이름 고르기' }).getByRole('button'));
  await page.getByRole('button', { name: '박서준' }).click();
  const grid = page.getByRole('group', { name: '재료 고르기' }).getByRole('button');
  await expect(grid).toHaveCount(30);
  await atLeast44(grid);
  // Ingredient names must not be cut off.
  const clipped = await page.locator('.em small').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(clipped, '잘린 재료 이름').toEqual([]);
  await page.getByRole('button', { name: '수박' }).click();
  await noSideScroll(page);
  await shot(page, '1-join');
});

test('냄비 목록', async ({ page }) => {
  await loginStudent(page);
  await expect(page.getByRole('button', { name: /학예회 준비/ })).toBeDisabled();
  await expect(page.getByText('이 냄비에서 잠시 나와 있어요')).toBeVisible();
  await noSideScroll(page);
  await shot(page, '2-lobby');
});

test('대화방', async ({ page }) => {
  await loginStudent(page);
  await page.getByRole('button', { name: /부대찌개반/ }).click();
  await expect(page.getByText('모두 내일 봐요 😊')).toBeVisible();
  await noSideScroll(page);

  const vp = page.viewportSize()!;
  const composer = page.locator('.composer');
  const box = (await composer.boundingBox())!;
  expect(box.y + box.height, '입력창이 화면 안').toBeLessThanOrEqual(vp.height + 1);
  await atLeast44(page.getByRole('button', { name: '보내기' }));

  const today = (await page.getByTestId('today-pot').boundingBox())!;
  expect(today.height, '오늘의 부대찌개 한 줄').toBeLessThanOrEqual(44);

  // Long unbroken link stays inside the screen.
  const long = page.locator('.bub', { hasText: 'abcdefghij' });
  const lb = (await long.boundingBox())!;
  expect(lb.x + lb.width, '긴 단어 말풍선').toBeLessThanOrEqual(vp.width);

  // Only the message list scrolls; the pot header stays at the top.
  await page.locator('.msgs').evaluate((el) => (el.scrollTop = 0));
  const header = (await page.locator('header.pot').boundingBox())!;
  expect(Math.abs(header.y)).toBeLessThanOrEqual(1);
  await page.locator('.msgs').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await shot(page, '3-room');

  // Keyboard focus: the composer is still in view.
  await page.getByRole('textbox', { name: '메시지' }).focus();
  const after = (await composer.boundingBox())!;
  expect(after.y + after.height).toBeLessThanOrEqual(vp.height + 1);
});

test('불 꺼진 대화방', async ({ page }) => {
  await loginStudent(page);
  await page.getByRole('button', { name: /과학 모둠 3조/ }).click();
  await expect(page.getByText('주방장이 냄비 불을 껐어요.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  await noSideScroll(page);
  await shot(page, '4-room-off');
});

test('재료 바꾸기 시트', async ({ page }) => {
  await loginStudent(page);
  await page.getByRole('button', { name: /부대찌개반/ }).click();
  await page.getByRole('button', { name: '내 재료와 메뉴' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await noSideScroll(page);
  await shot(page, '5-me-sheet');
});

test('선생님 홈', async ({ page }) => {
  await loginTeacher(page);
  await noSideScroll(page);
  await shot(page, '6-teacher-home');
  await page.getByRole('tab', { name: '📋 반 명단' }).click();
  await noSideScroll(page);
  await shot(page, '7-teacher-roster');
  await page.getByRole('tab', { name: '⚠️ 경고 기록' }).click();
  await expect(page.getByTestId('flag-row')).toHaveCount(1);
  await noSideScroll(page);
  await shot(page, '8-flag-log');
});

test('선생님 대화방', async ({ page }) => {
  await loginTeacher(page);
  await page.getByRole('button', { name: /부대찌개반/ }).click();
  await expect(page.getByText('가려짐')).toBeVisible();
  await noSideScroll(page);
  await shot(page, '9-teacher-room');
  const mobile = page.viewportSize()!.width <= 768;
  if (mobile) {
    // The fire switch is one tap away in the header on phones.
    await expect(page.locator('header .only-mobile').getByRole('switch', { name: '냄비 불' })).toBeVisible();
    await page.getByRole('button', { name: '불과 학생 관리' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noSideScroll(page);
    await shot(page, '10-teacher-sheet');
  } else {
    await expect(page.getByRole('complementary', { name: '냄비 관리' }).getByRole('switch', { name: '냄비 불' })).toBeVisible();
  }
});
