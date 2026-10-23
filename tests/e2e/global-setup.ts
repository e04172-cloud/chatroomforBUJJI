import { seed } from '../../scripts/seed-emulator';

export default async function globalSetup() {
  await seed();
}
