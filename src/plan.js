/**
 * What each plan may do. Billing is not connected: currentPlan() stays on free
 * until an account can select `plus`. Raise limits here instead of in the globe.
 */
export const PLANS = {
  free: {
    id: 'free',
    savedPlaces: 3,
    pastMinutes: 24 * 60,
    futureMinutes: 2 * 24 * 60,
  },
  plus: {
    id: 'plus',
    savedPlaces: 20,
    pastMinutes: 365 * 24 * 60,
    futureMinutes: 365 * 24 * 60,
  },
};

export function planById(id) {
  return PLANS[id] ?? PLANS.free;
}

export function currentPlan() {
  return planById('free');
}
