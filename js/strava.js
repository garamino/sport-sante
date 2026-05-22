import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js';
import { app } from './auth.js';
import { getStravaTokens, getStravaCredentials } from './db.js';

const functions = getFunctions(app, 'europe-west1');
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export function buildStravaAuthUrl(clientId) {
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
    approval_prompt: 'auto',
  });
  return `${STRAVA_AUTH_URL}?${params}`;
}

export async function exchangeStravaCode(code) {
  const fn = httpsCallable(functions, 'stravaExchange');
  const { data } = await fn({ code });
  return data;
}

async function getValidAccessToken() {
  const tokens = await getStravaTokens();
  if (!tokens?.accessToken) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt > nowSec + 60) return tokens.accessToken;

  // Token expiré — renouvellement automatique
  const fn = httpsCallable(functions, 'stravaRefresh');
  const { data } = await fn({});
  return data.accessToken;
}

export async function importLatestCyclingActivity(date) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    const err = new Error('not_connected');
    err.code = 'not_connected';
    throw err;
  }

  const dayStart = Math.floor(new Date(date + 'T00:00:00').getTime() / 1000);
  const dayEnd = Math.floor(new Date(date + 'T23:59:59').getTime() / 1000);

  const resp = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?after=${dayStart}&before=${dayEnd}&per_page=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (resp.status === 401) {
    const err = new Error('Token Strava invalide — reconnecte ton compte dans les paramètres');
    err.code = 'token_invalid';
    throw err;
  }
  if (!resp.ok) throw new Error(`Erreur API Strava (${resp.status})`);

  const activities = await resp.json();
  const ride = activities.find(a =>
    ['Ride', 'VirtualRide', 'EBikeRide'].includes(a.type) ||
    ['Ride', 'VirtualRide', 'EBikeRide'].includes(a.sport_type)
  );
  if (!ride) return null;

  return {
    fcAvg: Math.round(ride.average_heartrate || 0),
    wattsAvg: Math.round(ride.average_watts || ride.weighted_average_watts || 0),
    durationMinutes: Math.round((ride.moving_time || 0) / 60),
    distanceKm: parseFloat(((ride.distance || 0) / 1000).toFixed(1)),
    elevationGain: Math.round(ride.total_elevation_gain || 0),
    rpm: Math.round(ride.average_cadence || 0),
    stravaActivityId: ride.id,
    stravaActivityName: ride.name,
  };
}

export async function isStravaConnected() {
  const tokens = await getStravaTokens();
  return !!(tokens?.accessToken);
}

export async function isStravaConfigured() {
  const creds = await getStravaCredentials();
  return !!(creds?.clientId && creds?.clientSecret);
}
