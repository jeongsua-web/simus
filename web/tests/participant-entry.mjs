// Completes the required /participate entry form and waits for the city screen.
export async function enterCity(page, { nickname = '테스트시민', faculty = '정보미디어', department = '게임콘텐츠과', mbti = 'INFP' } = {}) {
  await page.getByLabel('닉네임', { exact: true }).fill(nickname);
  await page.getByRole('button', { name: faculty, exact: true }).click();
  await page.getByRole('radio', { name: department, exact: true }).click();
  for (const letter of mbti) await page.getByRole('radio', { name: new RegExp(`^${letter} `) }).click();
  await page.getByRole('button', { name: /도시에 입장하기/ }).click();
  await page.getByRole('region', { name: '도시와 선택' }).waitFor();
}
