import { z } from "zod";
import { ISO_DATE } from "@/domain/date";

export const isoDateSchema = z.string().regex(ISO_DATE, "Expected YYYY-MM-DD");
