import type { Locale } from "@evaluation/localization";
import type { ExperienceReceipt } from "@evaluation/contracts";

export type LocalizedReceipt = { locale: Locale; receipt: ExperienceReceipt };
