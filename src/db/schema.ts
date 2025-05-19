import { boolean } from "drizzle-orm/pg-core";
import { integer, pgTable, varchar, date } from "drizzle-orm/pg-core";

const commonFields = {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  price: integer().notNull(),
  image: varchar({ length: 255 }).notNull(),
  brand: varchar({ length: 255 }).notNull(),
  createdAt: date().defaultNow().notNull(),
};

export const gpusTable = pgTable("gpus", {
  ...commonFields,
  designer: varchar({ length: 255 }).notNull(),
});

export const processorsTable = pgTable("processors", {
  ...commonFields,
  coreCount: integer().notNull(),
  threadCount: integer().notNull(),
  baseClock: integer().notNull(),
  boostClock: integer().notNull(),
  socket: varchar({ length: 255 }).notNull(),
  tdp: integer().notNull(),
  hasIntegratedGraphics: boolean().notNull(),
});

export const motherboardsTable = pgTable("motherboards", {
  ...commonFields,
  socket: varchar({ length: 255 }).notNull(),
  chipset: varchar({ length: 255 }).notNull(),
  formFactor: varchar({ length: 255 }).notNull(),
  ramSlots: integer().notNull(),
  maxRam: integer().notNull(),
  ramType: varchar({ length: 255 }).notNull(),
  maxRamSpeed: integer().notNull(),
  connectivity: varchar({ length: 255 }).notNull(),
});

export const memoryModulesTable = pgTable("memory_modules", {
  ...commonFields,
  generation: varchar({ length: 255 }).notNull(),
  speed: integer().notNull(),
  size: integer().notNull(),
  formFactor: varchar({ length: 255 }).notNull(),
  voltage: integer().notNull(),
  timing: varchar({ length: 255 }).notNull(),
  hasIntelXMP: boolean().notNull(),
  hasAMDExpo: boolean().notNull(),
  hasHeatSpreader: boolean().notNull(),
  isRGB: boolean().notNull(),
});

export const powerSuppliesTable = pgTable("power_supplies", {
  ...commonFields,
  wattage: integer().notNull(),
  efficiencyRating: varchar({ length: 255 }).notNull(),
  modularity: varchar({ length: 255 }).notNull(),
  formFactor: varchar({ length: 255 }).notNull(),
});

export const casesTable = pgTable("cases", {
  ...commonFields,
  formFactor: varchar({ length: 255 }).notNull(),
  maxGPULength: integer().notNull(),
  maxCPUHeight: integer().notNull(),
  hasRGB: boolean().notNull(),
  hasTemperedGlass: boolean().notNull(),
  hasDustFilters: boolean().notNull(),
});

export const storageDevicesTable = pgTable("storage_devices", {
  ...commonFields,
  type: varchar({ length: 255 }).notNull(),
  capacity: integer().notNull(),
  formFactor: varchar({ length: 255 }).notNull(),
  interface: varchar({ length: 255 }).notNull(),
  readSpeed: integer().notNull(),
  writeSpeed: integer().notNull(),
});

export const coolingSolutionsTable = pgTable("cooling_solutions", {
  ...commonFields,
  type: varchar({ length: 255 }).notNull(),
  socketCompatibility: varchar({ length: 255 }).notNull(),
  tdpSupport: integer().notNull(),
  fanSize: integer().notNull(),
  hasRGB: boolean().notNull(),
  isLiquidCooling: boolean().notNull(),
});
