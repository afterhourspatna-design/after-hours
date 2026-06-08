import { PrismaClient, Role, BookingStatus, BookingSource, BookingType, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, subDays, setHours, setMinutes, setSeconds } from "date-fns";

const prisma = new PrismaClient();

function startOfDay(date: Date) {
  return setSeconds(setMinutes(setHours(date, 0), 0), 0);
}

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Clean up ───────────────────────────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.resourceUnit.deleteMany();
  await prisma.game.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.settings.deleteMany();

  // ─── Settings ───────────────────────────────────────────────────────
  await prisma.settings.createMany({
    data: [
      { key: "currency_symbol", value: "Rs" },
      { key: "venue_name", value: "After Hours Gaming Parlour" },
      { key: "venue_phone", value: "+91-300-0000000" },
      { key: "venue_email", value: "info@afterhours.in" },
      { key: "operating_hours_start", value: "10:00" },
      { key: "operating_hours_end", value: "24:00" },
      { key: "feature_customer_portal", value: "false" },
      { key: "hold_expiry_minutes", value: "15" },
    ],
  });

  // ─── Discount Rules ──────────────────────────────────────────────────
  await prisma.discountRule.createMany({
    data: [
      {
        minHoursInDay: 2,
        discountPct: 5,
        description: "5% off on 2nd hour when booking same day",
        isActive: true,
      },
      {
        minHoursInDay: 3,
        discountPct: 15,
        description: "15% off from 3rd hour onwards when booking same day",
        isActive: true,
      },
    ],
  });

  // ─── Admin & Staff Users ─────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 12);
  const staffHash = await bcrypt.hash("staff123", 12);
  const custHash = await bcrypt.hash("customer123", 12);

  const admin = await prisma.appUser.create({
    data: {
      name: "Admin",
      phone: "+91-300-1111111",
      email: "admin@afterhours.in",
      passwordHash: adminHash,
      role: Role.ADMIN,
      notes: "Super admin — change password after first login",
    },
  });

  const staff1 = await prisma.appUser.create({
    data: {
      name: "Bilal (Staff)",
      phone: "+91-300-2222222",
      email: "bilal@afterhours.in",
      passwordHash: staffHash,
      role: Role.STAFF,
    },
  });

  const staff2 = await prisma.appUser.create({
    data: {
      name: "Sara (Staff)",
      phone: "+91-300-3333333",
      email: "sara@afterhours.in",
      passwordHash: staffHash,
      role: Role.STAFF,
    },
  });

  const customer1 = await prisma.appUser.create({
    data: {
      name: "Ahmed Khan",
      phone: "+91-333-1001001",
      email: "ahmed@example.com",
      passwordHash: custHash,
      role: Role.CUSTOMER,
    },
  });

  const customer2 = await prisma.appUser.create({
    data: {
      name: "Fatima Malik",
      phone: "+91-333-2002002",
      email: "fatima@example.com",
      passwordHash: custHash,
      role: Role.CUSTOMER,
    },
  });

  const customer3 = await prisma.appUser.create({
    data: {
      name: "Usman Tariq",
      phone: "+91-333-3003003",
      role: Role.CUSTOMER,
    },
  });

  // ─── Games ────────────────────────────────────────────────────────────
  const ps5 = await prisma.game.create({
    data: {
      name: "PS5",
      tag: "ps5",
      description: "PlayStation 5 gaming station with latest titles",
      basePrice: 120,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      deposit: 500,
      isActive: true,
      totalUnits: 2,
      hasAccessories: true,
      defaultAccessories: 2,
      maxAccessories: 4,
      accessoryPrice: 25.00,
    },
  });

  const metaQuest = await prisma.game.create({
    data: {
      name: "Meta Quest",
      tag: "metaquest",
      description: "Virtual Reality gaming with Meta Quest 3",
      basePrice: 200,
      minTimeMinutes: 20,
      maxTimeMinutes: 60,
      deposit: 500,
      isActive: true,
      totalUnits: 1,
    },
  });

  const soccerTable = await prisma.game.create({
    data: {
      name: "Under Soccer Table",
      tag: "soccer",
      description: "Table football for 2-4 players",
      basePrice: 150,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      isActive: true,
      totalUnits: 1,
    },
  });

  const tableTennis = await prisma.game.create({
    data: {
      name: "Table Tennis",
      tag: "tabletennis",
      description: "Professional table tennis / ping pong",
      basePrice: 150,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      isActive: true,
      totalUnits: 1,
    },
  });

  const poolTable = await prisma.game.create({
    data: {
      name: "Pool Table",
      tag: "pool",
      description: "Billiards / Pool — 8-ball and 9-ball",
      basePrice: 150,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      isActive: true,
      totalUnits: 2,
    },
  });

  const basketball = await prisma.game.create({
    data: {
      name: "Basketball Hoop",
      tag: "basketball",
      description: "Indoor basketball shooting station",
      basePrice: 20,
      minTimeMinutes: 5,
      maxTimeMinutes: 5,
      isActive: true,
      totalUnits: 1,
    },
  });

  const foosball = await prisma.game.create({
    data: {
      name: "Foosball",
      tag: "foosball",
      description: "Classic foosball table for quick games",
      basePrice: 150,
      minTimeMinutes: 30,
      maxTimeMinutes: 60,
      isActive: true,
      totalUnits: 1,
    },
  });

  const dart = await prisma.game.create({
    data: {
      name: "Dart",
      tag: "dart",
      description: "Classic dart board station",
      basePrice: 20,
      minTimeMinutes: 5,
      maxTimeMinutes: 5,
      isActive: true,
      totalUnits: 1,
    },
  });

  const eventSpace = await prisma.game.create({
    data: {
      name: "Event Booking",
      tag: "event",
      description: "Full venue event booking — 2hr or 4hr blocks",
      basePrice: 750,
      minTimeMinutes: 120,
      maxTimeMinutes: 240,
      deposit: 2000,
      isActive: true,
      totalUnits: 1,
    },
  });

  // ─── Resource Units ───────────────────────────────────────────────────
  const ps5Unit1 = await prisma.resourceUnit.create({ data: { gameId: ps5.id, unitName: "PS5 - Unit 1" } });
  const ps5Unit2 = await prisma.resourceUnit.create({ data: { gameId: ps5.id, unitName: "PS5 - Unit 2" } });
  const metaUnit = await prisma.resourceUnit.create({ data: { gameId: metaQuest.id, unitName: "Meta Quest - Unit 1" } });
  const soccerUnit = await prisma.resourceUnit.create({ data: { gameId: soccerTable.id, unitName: "Soccer Table - 1" } });
  const ttUnit = await prisma.resourceUnit.create({ data: { gameId: tableTennis.id, unitName: "Table Tennis - 1" } });
  const pool1 = await prisma.resourceUnit.create({ data: { gameId: poolTable.id, unitName: "Pool Table - 1" } });
  const pool2 = await prisma.resourceUnit.create({ data: { gameId: poolTable.id, unitName: "Pool Table - 2" } });
  const basketUnit = await prisma.resourceUnit.create({ data: { gameId: basketball.id, unitName: "Basketball Hoop - 1" } });
  const foosUnit = await prisma.resourceUnit.create({ data: { gameId: foosball.id, unitName: "Foosball - 1" } });
  const dartUnit = await prisma.resourceUnit.create({ data: { gameId: dart.id, unitName: "Dart Board - 1" } });
  const eventUnit = await prisma.resourceUnit.create({ data: { gameId: eventSpace.id, unitName: "Event Space" } });

  // ─── Sample Bookings ──────────────────────────────────────────────────
  const today = new Date();
  const bookingData = [
    // Past week bookings
    {
      userId: customer1.id, gameId: ps5.id, resourceUnitId: ps5Unit1.id,
      startDateTime: setHours(subDays(today, 6), 14), endDateTime: setHours(subDays(today, 6), 16),
      durationMinutes: 120, bookingType: BookingType.HOURLY, basePrice: 1600, discountPct: 5,
      discountAmount: 40, finalAmount: 1560, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.WALK_IN,
    },
    {
      userId: customer2.id, gameId: poolTable.id, resourceUnitId: pool1.id,
      startDateTime: setHours(subDays(today, 5), 18), endDateTime: setHours(subDays(today, 5), 19),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 500, discountPct: 0,
      discountAmount: 0, finalAmount: 500, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.PHONE,
    },
    {
      guestName: "Zaid Guest", guestPhone: "+91-321-9999999", gameId: metaQuest.id, resourceUnitId: metaUnit.id,
      startDateTime: setHours(subDays(today, 4), 16), endDateTime: setHours(subDays(today, 4), 17),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 700, discountPct: 0,
      discountAmount: 0, finalAmount: 700, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.WALK_IN,
    },
    {
      userId: customer3.id, gameId: ps5.id, resourceUnitId: ps5Unit2.id,
      startDateTime: setHours(subDays(today, 3), 20), endDateTime: setHours(subDays(today, 3), 22),
      durationMinutes: 120, bookingType: BookingType.HOURLY, basePrice: 1600, discountPct: 0,
      discountAmount: 0, finalAmount: 1600, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.INSTAGRAM,
    },
    {
      userId: customer1.id, gameId: eventSpace.id, resourceUnitId: eventUnit.id,
      startDateTime: setHours(subDays(today, 2), 15), endDateTime: setHours(subDays(today, 2), 19),
      durationMinutes: 240, bookingType: BookingType.EVENT, basePrice: 20000, discountPct: 0,
      discountAmount: 0, finalAmount: 20000, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.REFERRAL,
      notes: "Birthday party — 20 guests",
    },
    {
      userId: customer2.id, gameId: tableTennis.id, resourceUnitId: ttUnit.id,
      startDateTime: setHours(subDays(today, 1), 17), endDateTime: setHours(subDays(today, 1), 18),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 400, discountPct: 0,
      discountAmount: 0, finalAmount: 400, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.COMPLETED, source: BookingSource.WALK_IN,
    },
    {
      guestName: "Hamza Walk-in", guestPhone: "+91-300-8888888", gameId: poolTable.id, resourceUnitId: pool2.id,
      startDateTime: setHours(subDays(today, 1), 21), endDateTime: setHours(subDays(today, 1), 22),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 500, discountPct: 0,
      discountAmount: 0, finalAmount: 500, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.CANCELLED, source: BookingSource.WALK_IN,
      notes: "No-show — cancelled",
    },
    // Today's bookings
    {
      userId: customer1.id, gameId: ps5.id, resourceUnitId: ps5Unit1.id,
      startDateTime: setHours(today, 11), endDateTime: setHours(today, 12),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 800, discountPct: 0,
      discountAmount: 0, finalAmount: 800, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.CONFIRMED, source: BookingSource.WALK_IN,
    },
    {
      userId: customer2.id, gameId: metaQuest.id, resourceUnitId: metaUnit.id,
      startDateTime: setHours(today, 14), endDateTime: setHours(today, 15),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 700, discountPct: 0,
      discountAmount: 0, finalAmount: 700, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.PENDING, source: BookingSource.PHONE,
    },
    {
      guestName: "Walk-in Guest", guestPhone: "+91-312-7777777", gameId: soccerTable.id, resourceUnitId: soccerUnit.id,
      startDateTime: addHours(today, 1), endDateTime: addHours(today, 2),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 400, discountPct: 0,
      discountAmount: 0, finalAmount: 400, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.CONFIRMED, source: BookingSource.WALK_IN,
    },
    // Future bookings
    {
      userId: customer3.id, gameId: ps5.id, resourceUnitId: ps5Unit2.id,
      startDateTime: setHours(addDays(today, 1), 16), endDateTime: setHours(addDays(today, 1), 18),
      durationMinutes: 120, bookingType: BookingType.HOURLY, basePrice: 1600, discountPct: 0,
      discountAmount: 0, finalAmount: 1600, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.CONFIRMED, source: BookingSource.ONLINE,
      notes: "Advance booking — call to confirm",
    },
    {
      userId: customer1.id, gameId: poolTable.id, resourceUnitId: pool1.id,
      startDateTime: setHours(addDays(today, 2), 19), endDateTime: setHours(addDays(today, 2), 21),
      durationMinutes: 120, bookingType: BookingType.HOURLY, basePrice: 1000, discountPct: 0,
      discountAmount: 0, finalAmount: 1000, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.PENDING, source: BookingSource.INSTAGRAM,
    },
    {
      guestName: "Corporate Event", guestPhone: "+91-300-5555555", gameId: eventSpace.id, resourceUnitId: eventUnit.id,
      startDateTime: setHours(addDays(today, 3), 18), endDateTime: setHours(addDays(today, 3), 22),
      durationMinutes: 240, bookingType: BookingType.EVENT, basePrice: 20000, discountPct: 0,
      discountAmount: 0, finalAmount: 20000, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.CONFIRMED, source: BookingSource.REFERRAL,
      notes: "Corporate team night — confirm headcount 48hrs before",
    },
    {
      userId: customer2.id, gameId: basketball.id, resourceUnitId: basketUnit.id,
      startDateTime: setHours(addDays(today, 1), 12), endDateTime: setHours(addDays(today, 1), 13),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 300, discountPct: 0,
      discountAmount: 0, finalAmount: 300, paymentStatus: PaymentStatus.UNPAID,
      bookingStatus: BookingStatus.PENDING, source: BookingSource.WALK_IN,
    },
    {
      userId: customer3.id, gameId: foosball.id, resourceUnitId: foosUnit.id,
      startDateTime: setHours(addDays(today, 2), 15), endDateTime: setHours(addDays(today, 2), 16),
      durationMinutes: 60, bookingType: BookingType.HOURLY, basePrice: 300, discountPct: 0,
      discountAmount: 0, finalAmount: 300, paymentStatus: PaymentStatus.PAID,
      bookingStatus: BookingStatus.CONFIRMED, source: BookingSource.PHONE,
    },
  ];

  for (const b of bookingData) {
    await prisma.booking.create({ data: b as any });
  }

  // ─── Coupons ─────────────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      {
        code: "WELCOME10",
        discountType: "PERCENTAGE",
        discountValue: 10.00,
        maxDiscountAmount: 200.00,
        minBookingAmount: 0.00,
        allowedRoles: ["ADMIN", "STAFF", "CUSTOMER"],
        isActive: true,
      },
      {
        code: "STAFFONLY",
        discountType: "FIXED",
        discountValue: 100.00,
        minBookingAmount: 500.00,
        allowedRoles: ["ADMIN", "STAFF"],
        isActive: true,
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`   👤 Users:     6 (1 admin, 2 staff, 3 customers)`);
  console.log(`   🎮 Games:     8`);
  console.log(`   📦 Units:     10`);
  console.log(`   📅 Bookings:  ${bookingData.length}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Admin:    admin@afterhours.in  / admin123`);
  console.log(`   Staff:    bilal@afterhours.in  / staff123`);
  console.log(`   Customer: ahmed@example.com    / customer123`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
