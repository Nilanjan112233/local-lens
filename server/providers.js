// Fictional demo businesses. Phone numbers are deliberately invalid
// (Indian numbers never start with 0 after +91) so the demo data cannot
// point at a real person.
const DEMO_PLACES = [
  [
    "Banyan & Bean Café",
    "Cafe",
    4.8,
    386,
    "+91 00000 00001",
    22.5729,
    88.3632,
    "12 Park Street",
  ],
  [
    "Studio Aaina",
    "Beauty salon",
    4.7,
    214,
    "+91 00000 00002",
    22.5751,
    88.3661,
    "8 Middleton Row",
  ],
  [
    "North Star Dental Care",
    "Dentist",
    4.9,
    168,
    "+91 00000 00003",
    22.5691,
    88.3598,
    "41 Shakespeare Sarani",
  ],
  [
    "Terracotta Kitchen",
    "Restaurant",
    4.6,
    742,
    "+91 00000 00004",
    22.5772,
    88.3614,
    "19 Camac Street",
  ],
  [
    "Forge Fitness Studio",
    "Gym",
    4.8,
    127,
    "+91 00000 00005",
    22.5682,
    88.3682,
    "27 Theatre Road",
  ],
  [
    "The Corner Bakehouse",
    "Bakery",
    4.7,
    493,
    "+91 00000 00006",
    22.5741,
    88.3568,
    "5 Russell Street",
  ],
  [
    "Greenline Physiotherapy",
    "Clinic",
    4.9,
    91,
    "+91 00000 00007",
    22.5663,
    88.3637,
    "16 Loudon Street",
  ],
  [
    "Craft & Grain Furnishings",
    "Furniture store",
    4.6,
    78,
    "+91 00000 00008",
    22.5802,
    88.3687,
    "31 Free School Street",
  ],
];

const PLACES_REQUEST_TIMEOUT_MS = 20_000;

export const DISCOVERY_CATEGORIES = [
  "restaurants",
  "cafes",
  "bakeries",
  "beauty salons",
  "dentists",
  "physiotherapy clinics",
  "gyms and fitness studios",
  "home repair contractors",
  "photographers",
  "event planners",
  "furniture stores",
  "pet groomers",
];

function locationOffset(location) {
  let hash = 0;
  for (const char of location)
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return {
    lat: ((hash % 31) - 15) / 1000,
    lng: (((hash >> 3) % 31) - 15) / 1000,
  };
}

export function demoSearch({ location, category }) {
  const offset = locationOffset(location);
  const categoryTerm = category.toLowerCase().trim();
  const filtered =
    categoryTerm && categoryTerm !== "all businesses"
      ? DEMO_PLACES.filter(
          (place) =>
            place[1].toLowerCase().includes(categoryTerm) ||
            categoryTerm.includes(place[1].toLowerCase()),
        )
      : DEMO_PLACES;
  const source = filtered.length
    ? filtered
    : DEMO_PLACES.slice(0, 5).map((place) => [
        place[0],
        category,
        ...place.slice(2),
      ]);
  return source.map(
    ([name, type, rating, reviewCount, phone, lat, lng, address], index) => ({
      id: `demo-${index}-${location.toLowerCase().replace(/\W+/g, "-")}`,
      name,
      category: type,
      rating,
      reviewCount,
      phone,
      website: null,
      address: `${address}, ${location}`,
      location: { lat: lat + offset.lat, lng: lng + offset.lng },
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${location}`)}`,
      businessStatus: "OPERATIONAL",
      querySources: ["demo"],
    }),
  );
}

export function buildSearchPlan(category, depth) {
  const all = !category || category.toLowerCase() === "all businesses";
  const limits =
    depth === "deep"
      ? { queries: 12, pages: 2 }
      : depth === "quick"
        ? { queries: 1, pages: 1 }
        : { queries: 8, pages: 1 };
  const queries = all
    ? DISCOVERY_CATEGORIES
    : [category, `independent ${category}`, `local ${category}`];
  return {
    queries: queries.slice(0, limits.queries),
    pagesPerQuery: limits.pages,
  };
}

function normalizePlace(place, category, query) {
  return {
    id: place.id,
    name: place.displayName?.text || "Unnamed business",
    category: place.primaryTypeDisplayName?.text || category,
    rating: place.rating || 0,
    reviewCount: place.userRatingCount || 0,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    address: place.formattedAddress || "",
    location: { lat: place.location?.latitude, lng: place.location?.longitude },
    mapsUrl: place.googleMapsUri,
    businessStatus: place.businessStatus,
    querySources: [query],
  };
}

async function fetchTextSearchPage({ query, location, apiKey, pageToken }) {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.primaryTypeDisplayName",
    "places.rating",
    "places.userRatingCount",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.location",
    "places.googleMapsUri",
    "places.businessStatus",
    "nextPageToken",
  ].join(",");
  let response;
  try {
    response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        signal: AbortSignal.timeout(PLACES_REQUEST_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify({
          textQuery: `${query} in ${location}`,
          pageSize: 20,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
    );
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new Error(
        `Google Places request timed out after ${PLACES_REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google Places request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  return response.json();
}

async function searchOneQuery({ query, location, apiKey, pagesPerQuery }) {
  const places = [];
  let pageToken;
  let pagesFetched = 0;
  do {
    const payload = await fetchTextSearchPage({
      query,
      location,
      apiKey,
      pageToken,
    });
    places.push(
      ...(payload.places || []).map((place) =>
        normalizePlace(place, query, query),
      ),
    );
    pagesFetched += 1;
    pageToken = payload.nextPageToken;
  } while (pageToken && pagesFetched < pagesPerQuery);
  return { query, places, pagesFetched };
}

export async function googlePlacesSearch({
  location,
  category,
  apiKey,
  depth = "standard",
}) {
  const plan = buildSearchPlan(category, depth);
  const results = [];
  // Small batches protect quotas while still reducing wait time for broad searches.
  for (let index = 0; index < plan.queries.length; index += 3) {
    const batch = plan.queries.slice(index, index + 3);
    results.push(
      ...(await Promise.all(
        batch.map((query) =>
          searchOneQuery({
            query,
            location,
            apiKey,
            pagesPerQuery: plan.pagesPerQuery,
          }),
        ),
      )),
    );
  }
  const deduped = new Map();
  for (const result of results) {
    for (const place of result.places) {
      const existing = deduped.get(place.id);
      if (existing)
        existing.querySources = [
          ...new Set([...existing.querySources, ...place.querySources]),
        ];
      else deduped.set(place.id, place);
    }
  }
  return {
    places: [...deduped.values()],
    diagnostics: {
      queriesExecuted: results.length,
      pagesFetched: results.reduce(
        (sum, result) => sum + result.pagesFetched,
        0,
      ),
      rawResults: results.reduce(
        (sum, result) => sum + result.places.length,
        0,
      ),
      uniquePlaces: deduped.size,
      queryPlan: results.map((result) => ({
        query: result.query,
        results: result.places.length,
        pages: result.pagesFetched,
      })),
    },
  };
}
