"use server";

import { getCityEmployers, type CityEmployers } from "@/lib/employers";

/** Client-callable fetch for the city-employers dialog. */
export async function fetchCityEmployers(
  city: string,
  family: string | null
): Promise<CityEmployers> {
  return getCityEmployers(city, family);
}
