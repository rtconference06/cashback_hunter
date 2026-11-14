import { addUtcDays, formatDateInput, ownerToday } from "../src/lib/dates";
import { prisma } from "../src/lib/db";
import { completeOccasion, createOccasion, createPerson } from "../src/lib/people";
import { runSearch } from "../src/lib/search-service";
import { runUpcomingDigests } from "../src/lib/digest-service";

const force = process.argv.includes("--force");

async function main() {
  const existing = await prisma.person.count();
  if (existing > 0 && !force) {
    console.log("Seed skipped: people already exist. Run npm run db:reset to start over.");
    return;
  }
  if (force) {
    await prisma.savedDeal.deleteMany();
    await prisma.productOption.deleteMany();
    await prisma.digest.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.searchRun.deleteMany();
    await prisma.occasion.deleteMany();
    await prisma.person.deleteMany();
    await prisma.user.deleteMany();
  }

  const today = ownerToday();
  const iso = (days: number) => formatDateInput(addUtcDays(today, days));

  const maya = await createPerson({
    name: "Maya Chen",
    relationship: "Sister",
    email: "maya.chen@example.com",
    likes: "ceramic mugs, matcha, novels",
    dislikes: "scented candles, fast fashion",
    hobbies: "pottery, reading",
    budget: "60",
    notes: "Useful gifts beat novelty. She will notice if it is cheap plastic.",
  });
  await createOccasion(maya.id, {
    kind: "birthday",
    title: "Birthday",
    date: iso(18),
    recurring: true,
    budget: "",
    notes: "",
  });
  const housewarming = await createOccasion(maya.id, {
    kind: "custom",
    title: "Housewarming",
    date: iso(-40),
    recurring: false,
    budget: "",
    notes: "",
  });
  const dinner = await createOccasion(maya.id, {
    kind: "custom",
    title: "Sunday dinner",
    date: iso(-12),
    recurring: false,
    budget: "",
    notes: "",
  });
  await completeOccasion(housewarming.id, {
    noGift: false,
    title: "Handmade Ceramic Mug",
    price: "30.60",
    store: "Uncommon Goods",
    link: "https://www.rakuten.com/#sample-ceramic-mug",
    purchasedOn: iso(-38),
    note: "Picked from the suggested deals. She uses it every morning.",
  });
  await completeOccasion(dinner.id, {
    noGift: true,
    title: "",
    price: "",
    store: "",
    link: "",
    purchasedOn: iso(-12),
    note: "Cooked at her place instead.",
  });
  await runSearch({ personId: maya.id });

  const alvarez = await createPerson({
    name: "Mr. Alvarez",
    relationship: "Teacher",
    email: "m.alvarez@school.example",
    likes: "fountain pens, pour-over coffee, birding guides",
    dislikes: "world's best teacher mugs",
    hobbies: "birding, crosswords",
    budget: "35",
    notes: "Skip anything that says World's Best Teacher.",
  });
  await createOccasion(alvarez.id, {
    kind: "teachers_day",
    title: "Teachers' Day",
    date: iso(6),
    recurring: true,
    budget: "",
    notes: "",
  });
  await runSearch({ personId: alvarez.id });

  const jordan = await createPerson({
    name: "Jordan Hale",
    relationship: "Friend",
    email: "jordan@example.com",
    likes: "trail running, hot sauce, vinyl",
    dislikes: "graphic tees",
    hobbies: "trail running, cooking",
    budget: "45",
    notes: "",
  });
  await createOccasion(jordan.id, {
    kind: "birthday",
    title: "Birthday",
    date: iso(12),
    recurring: true,
    budget: "",
    notes: "",
  });

  const priya = await createPerson({
    name: "Aunt Priya",
    relationship: "Family",
    email: "",
    likes: "gardening, loose leaf tea, cookbooks",
    dislikes: "plastic gadgets",
    hobbies: "gardening, knitting",
    budget: "50",
    notes: "",
  });
  await createOccasion(priya.id, {
    kind: "anniversary",
    title: "Anniversary",
    date: iso(40),
    recurring: true,
    budget: "",
    notes: "",
  });

  const sam = await createPerson({
    name: "Sam Ortiz",
    relationship: "Nephew",
    email: "",
    likes: "dinosaurs, drawing, space",
    dislikes: "candy, noisy toys",
    hobbies: "drawing",
    budget: "40",
    notes: "School shoes are a size 1.",
  });
  const boots = await createOccasion(sam.id, {
    kind: "adhoc",
    title: "Winter boots",
    date: "",
    recurring: false,
    budget: "",
    notes: "Something he can wear to school.",
  });
  await runSearch({ personId: sam.id, occasionId: boots.id });

  const casey = await createPerson({
    name: "Casey Ng",
    relationship: "Coworker",
    email: "casey.ng@example.com",
    likes: "private jet charter",
    dislikes: "mugs",
    hobbies: "yachting",
    budget: "8",
    notes: "A tiny budget on purpose, so the empty state is easy to find.",
  });
  await createOccasion(casey.id, {
    kind: "birthday",
    title: "Birthday",
    date: iso(25),
    recurring: true,
    budget: "",
    notes: "",
  });
  await runSearch({ personId: casey.id });

  const robin = await createPerson({
    name: "Robin Hale",
    relationship: "Neighbor",
    email: "robin@example.com",
    likes: "bread baking",
    dislikes: "",
    hobbies: "baking",
    budget: "30",
    notes: "",
  });
  await createOccasion(robin.id, {
    kind: "birthday",
    title: "Birthday",
    date: iso(3),
    recurring: true,
    budget: "",
    notes: "",
  });
  await prisma.person.update({ where: { id: robin.id }, data: { archivedAt: new Date() } });

  await runUpcomingDigests();
  console.log("Seeded Gift Hunter with sample people, deals, history, and a logged digest.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
