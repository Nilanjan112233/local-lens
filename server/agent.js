const PLAYBOOKS = {
  restaurant: {
    type: "Conversion-first restaurant site",
    features: [
      "Mobile menu",
      "Table booking",
      "Click-to-call",
      "Directions & hours",
    ],
    angle: "Turn local discovery into bookings and direct orders.",
  },
  cafe: {
    type: "Visual café microsite",
    features: [
      "Menu highlights",
      "Photo gallery",
      "Map & hours",
      "Instagram feed",
    ],
    angle: "Show the atmosphere before a customer chooses where to go.",
  },
  salon: {
    type: "Service and booking website",
    features: [
      "Online appointments",
      "Service pricing",
      "Stylist gallery",
      "WhatsApp enquiry",
    ],
    angle: "Reduce booking friction and showcase results.",
  },
  dentist: {
    type: "Trust-led healthcare website",
    features: [
      "Treatment pages",
      "Appointment request",
      "Doctor profiles",
      "Insurance FAQ",
    ],
    angle: "Convert review trust into qualified appointment requests.",
  },
  clinic: {
    type: "Patient acquisition website",
    features: [
      "Doctor profiles",
      "Appointment request",
      "Services",
      "Location & hours",
    ],
    angle: "Help patients understand services and book with confidence.",
  },
  gym: {
    type: "Membership landing site",
    features: [
      "Trial signup",
      "Class schedule",
      "Trainer profiles",
      "Membership plans",
    ],
    angle: "Turn nearby search traffic into trials and memberships.",
  },
  contractor: {
    type: "Local service lead-generation site",
    features: [
      "Quote request",
      "Project gallery",
      "Service areas",
      "Trust badges",
    ],
    angle: "Win high-intent local enquiries with proof of work.",
  },
  store: {
    type: "Local catalog website",
    features: [
      "Product catalog",
      "WhatsApp ordering",
      "Store information",
      "Featured offers",
    ],
    angle: "Let customers browse before they visit or message.",
  },
  default: {
    type: "Local business starter site",
    features: [
      "Services overview",
      "Contact form",
      "Reviews showcase",
      "Local SEO basics",
    ],
    angle: "Own the customer journey beyond a third-party listing.",
  },
};

export function getPlaybook(category = "") {
  const key = Object.keys(PLAYBOOKS).find(
    (name) => name !== "default" && category.toLowerCase().includes(name),
  );
  return PLAYBOOKS[key || "default"];
}

export function scoreOpportunity(place) {
  const ratingScore = Math.max(
    0,
    Math.min(40, ((place.rating || 0) - 3.5) * 26.67),
  );
  const reviewScore = Math.max(
    0,
    Math.min(35, Math.log10((place.reviewCount || 0) + 1) * 14),
  );
  const contactScore = place.phone ? 15 : 5;
  const openScore = place.businessStatus === "OPERATIONAL" ? 10 : 3;
  return Math.round(
    Math.min(100, ratingScore + reviewScore + contactScore + openScore),
  );
}

export function qualifyAndRecommend(place, thresholds) {
  const noWebsiteListed = !place.website;
  const operational =
    !place.businessStatus || place.businessStatus === "OPERATIONAL";
  const qualifies =
    noWebsiteListed &&
    operational &&
    place.rating >= thresholds.minRating &&
    place.reviewCount >= thresholds.minReviews;
  const playbook = getPlaybook(place.category);
  return {
    ...place,
    qualifies,
    opportunityScore: scoreOpportunity(place),
    websiteEvidence: noWebsiteListed ? "not_listed" : "listed",
    verificationStatus: noWebsiteListed ? "needs_verification" : "not_needed",
    recommendation: playbook,
    reasons: [
      `${place.rating.toFixed(1)} rating from ${place.reviewCount.toLocaleString()} reviews`,
      noWebsiteListed
        ? "No website is listed on the source profile"
        : "A website is already listed",
      playbook.angle,
    ],
    rejectionReasons: [
      ...(!noWebsiteListed ? ["website_listed"] : []),
      ...(!operational ? ["not_operational"] : []),
      ...(place.rating < thresholds.minRating
        ? ["rating_below_threshold"]
        : []),
      ...(place.reviewCount < thresholds.minReviews
        ? ["reviews_below_threshold"]
        : []),
    ],
  };
}
